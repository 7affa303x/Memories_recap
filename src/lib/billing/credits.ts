import { randomUUID } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  CREDIT_EXPIRY_DAYS,
  DAILY_LOGIN_BALANCE_CAP,
  DAILY_LOGIN_CREDITS,
  FREE_CREDITS,
} from "@/lib/billing/config";
import type {
  BillingState,
  BillingSubscription,
  CreditHistoryEntry,
  CreditLot,
  CreditSource,
  BillingTransaction,
} from "@/lib/billing/types";

const BUCKET = "app-data";

function emptyState(userId: string, email: string): BillingState {
  return {
    version: 0,
    userId,
    email,
    creemCustomerId: null,
    freeGranted: false,
    watermarkExempt: false,
    lastDailyLoginGrantAt: null,
    lots: [],
    subscription: null,
    transactions: [],
    history: [],
    jobCredits: {},
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(raw: BillingState): BillingState {
  // Compat only: older Storage JSON may still carry Polar/Paddle field names.
  // Active billing is Gumroad (primary) or Creem (fallback) — do not treat Polar/Paddle as live MoR.
  const anyRaw = raw as BillingState & {
    polarCustomerId?: string | null;
    paddleCustomerId?: string | null;
    subscription?: (BillingSubscription & {
      polarSubscriptionId?: string;
      polarProductId?: string;
      paddleSubscriptionId?: string;
      paddlePriceId?: string;
    }) | null;
  };

  if (!anyRaw.creemCustomerId) {
    // legacy rename → creemCustomerId (storage key name retained for Gumroad/Creem)
    anyRaw.creemCustomerId =
      anyRaw.paddleCustomerId || anyRaw.polarCustomerId || null;
  }

  if (anyRaw.subscription) {
    const sub = anyRaw.subscription;
    if (!sub.creemSubscriptionId) {
      sub.creemSubscriptionId =
        sub.paddleSubscriptionId || sub.polarSubscriptionId || sub.id;
    }
    if (!sub.creemProductId) {
      sub.creemProductId = sub.paddlePriceId || sub.polarProductId || "";
    }
  }

  for (const lot of anyRaw.lots ?? []) {
    const legacy = lot as CreditLot & {
      polarEventId?: string | null;
      paddleEventId?: string | null;
    };
    if (!legacy.creemEventId) {
      legacy.creemEventId = legacy.paddleEventId || legacy.polarEventId || null;
    }
  }

  for (const tx of anyRaw.transactions ?? []) {
    const legacy = tx as BillingTransaction & {
      polarEventId?: string | null;
      polarOrderId?: string | null;
      paddleEventId?: string | null;
      paddleTransactionId?: string | null;
    };
    if (!legacy.creemEventId) {
      legacy.creemEventId = legacy.paddleEventId || legacy.polarEventId || null;
    }
    if (!legacy.creemOrderId) {
      legacy.creemOrderId =
        legacy.paddleTransactionId || legacy.polarOrderId || null;
    }
  }

  if (anyRaw.watermarkExempt == null) {
    anyRaw.watermarkExempt = (anyRaw.lots ?? []).some(
      (lot) => lot.source === "pack"
    );
  }

  return anyRaw;
}

/** Pack purchases remove the overlay watermark (end card kept). Pure helper for tests. */
export function watermarkExemptAfterGrant(
  current: boolean | undefined,
  source: CreditSource
): boolean {
  return Boolean(current) || source === "pack";
}

async function readState(userId: string): Promise<BillingState | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`billing/${userId}.json`);
  if (error || !data) return null;
  return normalizeState(JSON.parse(await data.text()) as BillingState);
}

async function writeState(state: BillingState) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`billing/${state.userId}.json`, JSON.stringify(state, null, 2), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export function availableCredits(state: BillingState, at = new Date()) {
  return state.lots
    .filter((lot) => lot.remainingAmount > 0 && new Date(lot.expiresAt) > at)
    .reduce((sum, lot) => sum + lot.remainingAmount, 0);
}

async function mutate(
  userId: string,
  email: string,
  fn: (state: BillingState) => void
) {
  let lastError: Error | null = null;
  const supabase = getServiceSupabase();
  const lockPath = `billing-locks/mutate-${userId}.json`;

  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const current = (await readState(userId)) ?? emptyState(userId, email);
      const expected = current.version;
      const next = structuredClone(current);
      next.email = email || next.email;
      fn(next);
      next.version = expected + 1;
      next.updatedAt = new Date().toISOString();

      const lock = await supabase.storage.from(BUCKET).upload(
        lockPath,
        JSON.stringify({ at: Date.now(), attempt }),
        { contentType: "application/json", upsert: false }
      );
      if (lock.error) {
        // Break stale locks older than 15s so grants/pages don't soft-fail forever
        const stale = await supabase.storage.from(BUCKET).download(lockPath);
        if (stale.data) {
          try {
            const meta = JSON.parse(await stale.data.text()) as { at?: number };
            if (!meta.at || Date.now() - meta.at > 15_000) {
              await supabase.storage.from(BUCKET).remove([lockPath]);
            }
          } catch {
            await supabase.storage.from(BUCKET).remove([lockPath]);
          }
        }
        await new Promise((r) => setTimeout(r, 50 + attempt * 40));
        continue;
      }

      try {
        const confirm = (await readState(userId)) ?? emptyState(userId, email);
        if (confirm.version !== expected) {
          continue;
        }

        await writeState(next);

        const saved = await readState(userId);
        if (saved && saved.version === next.version) return saved;
        if (!saved || saved.version < next.version) {
          await new Promise((r) => setTimeout(r, 60));
          const again = await readState(userId);
          if (again && again.version >= next.version) return again;
          return next;
        }
      } finally {
        await supabase.storage.from(BUCKET).remove([lockPath]);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("mutate failed");
      await supabase.storage.from(BUCKET).remove([lockPath]).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 40 + attempt * 25));
    }
  }

  const fallback = await readState(userId);
  if (fallback) return fallback;
  throw (
    lastError || new Error("Could not update billing state (concurrent writes)")
  );
}

function addLot(
  state: BillingState,
  input: {
    amount: number;
    source: CreditSource;
    creemEventId?: string | null;
  }
) {
  const expiryDays =
    input.source === "subscription" ? 365 : CREDIT_EXPIRY_DAYS;
  const lot: CreditLot = {
    id: randomUUID(),
    source: input.source,
    originalAmount: input.amount,
    remainingAmount: input.amount,
    expiresAt: new Date(
      Date.now() + expiryDays * 24 * 60 * 60 * 1000
    ).toISOString(),
    creemEventId: input.creemEventId ?? null,
    createdAt: new Date().toISOString(),
  };
  state.lots.push(lot);
  const history: CreditHistoryEntry = {
    id: randomUUID(),
    lotId: lot.id,
    delta: input.amount,
    reason: `grant:${input.source}`,
    balanceAfter: availableCredits(state),
    createdAt: new Date().toISOString(),
  };
  state.history.unshift(history);
  return lot;
}

async function claimFreeGrant(userId: string) {
  const supabase = getServiceSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(
    `billing-locks/free-${userId}.json`,
    JSON.stringify({ userId, at: new Date().toISOString() }),
    { contentType: "application/json", upsert: false }
  );
  if (!error) return true;
  return false;
}

export async function ensureBillingUser(userId: string, email: string) {
  const claimed = await claimFreeGrant(userId);
  return mutate(userId, email, (state) => {
    if (claimed && !state.freeGranted) {
      addLot(state, { amount: FREE_CREDITS, source: "free" });
      state.freeGranted = true;
      state.transactions.unshift({
        id: randomUUID(),
        type: "free_grant",
        amount: FREE_CREDITS,
        createdAt: new Date().toISOString(),
        metadata: { oneTime: true },
      });
    } else if (!claimed) {
      state.freeGranted = true;
    }
  });
}

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily login top-up when balance is under the cap. Idempotent per UTC day.
 * Also advances visit streak (Earn / Moments).
 */
export async function grantDailyLoginCredits(userId: string, email: string) {
  await ensureBillingUser(userId, email);
  const { listJobsForUser } = await import("@/lib/store");
  const jobs = await listJobsForUser(userId);
  const hasCompletedRecap = jobs.some((job) => job.status === "completed");

  let state =
    (await readState(userId)) ?? emptyState(userId, email);

  if (hasCompletedRecap) {
    state = await mutate(userId, email, (next) => {
      const today = utcDayKey();
      if (next.lastDailyLoginGrantAt === today) return;
      const balance = availableCredits(next);
      if (balance > DAILY_LOGIN_BALANCE_CAP) {
        next.lastDailyLoginGrantAt = today;
        return;
      }
      addLot(next, { amount: DAILY_LOGIN_CREDITS, source: "daily_login" });
      next.lastDailyLoginGrantAt = today;
      next.transactions.unshift({
        id: randomUUID(),
        type: "daily_login_grant",
        amount: DAILY_LOGIN_CREDITS,
        createdAt: new Date().toISOString(),
        metadata: { day: today, balanceBefore: balance },
      });
    });
  }

  try {
    const { touchStreak } = await import("@/lib/rewards/streak");
    const { grantStreakBonus } = await import("@/lib/rewards/grants");
    const { advanced, hit7, hit30 } = await touchStreak(userId);
    if (advanced && hit7) {
      await grantStreakBonus(userId, email, 7).catch(() => undefined);
    }
    if (advanced && hit30) {
      await grantStreakBonus(userId, email, 30).catch(() => undefined);
    }
  } catch {
    /* streak optional */
  }

  return state;
}

export async function getBillingSummary(userId: string, email: string) {
  try {
    await ensureBillingUser(userId, email);
    const state = await grantDailyLoginCredits(userId, email);
    const { readStreak } = await import("@/lib/rewards/streak");
    const streak = await readStreak(userId).catch(() => ({
      current: 0,
      longest: 0,
    }));
    const packPurchaseAt = [...(state.transactions || [])]
      .filter((t) => t.type === "purchase" || t.type === "pack_purchase" || t.metadata?.productKey)
      .map((t) => t.createdAt)
      .sort()
      .reverse()[0];
    const proDiscountEligible = Boolean(
      packPurchaseAt &&
        Date.now() - new Date(packPurchaseAt).getTime() <
          7 * 24 * 60 * 60 * 1000 &&
        !(
          state.subscription &&
          ["active", "trialing"].includes(state.subscription.status)
        )
    );
    return {
      balance: availableCredits(state),
      freeGranted: state.freeGranted,
      watermarkExempt: Boolean(state.watermarkExempt),
      dailyLoginGrantedToday: state.lastDailyLoginGrantAt === utcDayKey(),
      dailyLoginAmount: DAILY_LOGIN_CREDITS,
      dailyLoginCap: DAILY_LOGIN_BALANCE_CAP,
      subscription: state.subscription,
      lots: state.lots.filter(
        (lot) => lot.remainingAmount > 0 && new Date(lot.expiresAt) > new Date()
      ),
      transactions: state.transactions.slice(0, 50),
      history: state.history.slice(0, 50),
      creemCustomerId: state.creemCustomerId,
      streakCurrent: streak.current,
      streakLongest: streak.longest,
      proDiscountEligible,
      momentsName: "Moments",
    };
  } catch (error) {
    console.error("getBillingSummary failed", error);
    const state = (await readState(userId)) ?? emptyState(userId, email);
    const streak = await import("@/lib/rewards/streak")
      .then((m) => m.readStreak(userId))
      .catch(() => ({ current: 0, longest: 0 }));
    return {
      balance: availableCredits(state),
      freeGranted: state.freeGranted,
      watermarkExempt: Boolean(state.watermarkExempt),
      dailyLoginGrantedToday: state.lastDailyLoginGrantAt === utcDayKey(),
      dailyLoginAmount: DAILY_LOGIN_CREDITS,
      dailyLoginCap: DAILY_LOGIN_BALANCE_CAP,
      subscription: state.subscription,
      lots: state.lots.filter(
        (lot) => lot.remainingAmount > 0 && new Date(lot.expiresAt) > new Date()
      ),
      transactions: state.transactions.slice(0, 50),
      history: state.history.slice(0, 50),
      creemCustomerId: state.creemCustomerId,
      streakCurrent: streak.current,
      streakLongest: streak.longest,
      proDiscountEligible: false,
      momentsName: "Moments",
    };
  }
}

export async function setCreemCustomerId(
  userId: string,
  email: string,
  creemCustomerId: string
) {
  return mutate(userId, email, (state) => {
    state.creemCustomerId = creemCustomerId;
  });
}

export async function grantCredits(input: {
  userId: string;
  email: string;
  amount: number;
  source: CreditSource;
  creemEventId: string;
  creemOrderId?: string | null;
  type: string;
  metadata?: Record<string, unknown>;
}) {
  return mutate(input.userId, input.email, (state) => {
    if (
      input.creemEventId &&
      state.transactions.some((tx) => tx.creemEventId === input.creemEventId)
    ) {
      return;
    }
    addLot(state, {
      amount: input.amount,
      source: input.source,
      creemEventId: input.creemEventId,
    });
    state.watermarkExempt = watermarkExemptAfterGrant(
      state.watermarkExempt,
      input.source
    );
    const tx: BillingTransaction = {
      id: randomUUID(),
      type: input.type,
      amount: input.amount,
      creemEventId: input.creemEventId,
      creemOrderId: input.creemOrderId ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    state.transactions.unshift(tx);
  });
}

export async function upsertSubscription(input: {
  userId: string;
  email: string;
  subscription: BillingSubscription;
}) {
  return mutate(input.userId, input.email, (state) => {
    state.subscription = input.subscription;
  });
}

export async function deductCreditsForJob(input: {
  userId: string;
  email: string;
  jobId: string;
  amount: number;
}) {
  if (input.amount <= 0) throw new Error("amount must be positive");

  return mutate(input.userId, input.email, (state) => {
    const existing = state.jobCredits[input.jobId];
    if (
      existing &&
      (existing.status === "reserved" || existing.status === "consumed")
    ) {
      return;
    }

    if (availableCredits(state) < input.amount) {
      throw new Error("insufficient_credits");
    }

    let need = input.amount;
    const now = new Date();
    const lots = [...state.lots].sort(
      (a, b) =>
        new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime() ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.remainingAmount <= 0) continue;
      if (new Date(lot.expiresAt) <= now) continue;
      const take = Math.min(lot.remainingAmount, need);
      lot.remainingAmount -= take;
      need -= take;
    }

    if (need > 0) throw new Error("insufficient_credits");

    state.jobCredits[input.jobId] = {
      charged: input.amount,
      status: "reserved",
    };

    state.history.unshift({
      id: randomUUID(),
      jobId: input.jobId,
      delta: -input.amount,
      reason: "processing_reserve",
      balanceAfter: availableCredits(state),
      createdAt: new Date().toISOString(),
    });
  });
}

export async function finalizeJobCredits(input: {
  userId: string;
  email: string;
  jobId: string;
  outcome: "consumed" | "restored";
}) {
  return mutate(input.userId, input.email, (state) => {
    const entry = state.jobCredits[input.jobId];
    if (!entry || entry.status === input.outcome) return;

    if (input.outcome === "restored" && entry.status === "reserved") {
      addLot(state, {
        amount: entry.charged,
        source: "refund_restore",
      });
      entry.status = "restored";
      state.history.unshift({
        id: randomUUID(),
        jobId: input.jobId,
        delta: entry.charged,
        reason: "processing_failed_restore",
        balanceAfter: availableCredits(state),
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (input.outcome === "consumed" && entry.status === "reserved") {
      entry.status = "consumed";
      state.history.unshift({
        id: randomUUID(),
        jobId: input.jobId,
        delta: 0,
        reason: "processing_consumed",
        balanceAfter: availableCredits(state),
        createdAt: new Date().toISOString(),
      });
    }
  });
}

export async function restoreCreditsForRefund(input: {
  userId: string;
  email: string;
  amount: number;
  creemEventId: string;
  creemOrderId?: string | null;
  jobId?: string | null;
}) {
  return mutate(input.userId, input.email, (state) => {
    if (state.transactions.some((tx) => tx.creemEventId === input.creemEventId)) {
      return;
    }

    if (input.jobId) {
      const job = state.jobCredits[input.jobId];
      if (job?.status === "consumed") {
        state.transactions.unshift({
          id: randomUUID(),
          type: "refund_denied_completed_job",
          amount: 0,
          creemEventId: input.creemEventId,
          creemOrderId: input.creemOrderId ?? null,
          metadata: { jobId: input.jobId },
          createdAt: new Date().toISOString(),
        });
        return;
      }
      if (job?.status === "reserved") {
        addLot(state, {
          amount: job.charged,
          source: "refund_restore",
          creemEventId: input.creemEventId,
        });
        job.status = "restored";
      } else {
        addLot(state, {
          amount: input.amount,
          source: "refund_restore",
          creemEventId: input.creemEventId,
        });
      }
    } else {
      addLot(state, {
        amount: input.amount,
        source: "refund_restore",
        creemEventId: input.creemEventId,
      });
    }

    state.transactions.unshift({
      id: randomUUID(),
      type: "refund",
      amount: input.amount,
      creemEventId: input.creemEventId,
      creemOrderId: input.creemOrderId ?? null,
      metadata: { jobId: input.jobId ?? null },
      createdAt: new Date().toISOString(),
    });
  });
}

export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  const path = `webhooks/${eventId}.json`;
  const existing = await supabase.storage.from(BUCKET).download(path);
  return Boolean(existing.data) && !existing.error;
}

/**
 * Mark a webhook event as processed. Returns false if already recorded.
 * Callers should grant credits / apply side effects BEFORE marking, so a
 * failed grant is retryable on the next delivery.
 */
export async function markWebhookProcessed(eventId: string, type: string) {
  const supabase = getServiceSupabase();
  const path = `webhooks/${eventId}.json`;
  const { error } = await supabase.storage.from(BUCKET).upload(
    path,
    JSON.stringify({
      id: eventId,
      type,
      processedAt: new Date().toISOString(),
    }),
    { contentType: "application/json", upsert: false }
  );

  if (!error) return true;
  const existing = await supabase.storage.from(BUCKET).download(path);
  if (!existing.error) return false;
  throw new Error(error.message);
}
