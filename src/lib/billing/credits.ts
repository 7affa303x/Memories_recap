import { randomUUID } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  CREDIT_EXPIRY_DAYS,
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
    polarCustomerId: null,
    freeGranted: false,
    lots: [],
    subscription: null,
    transactions: [],
    history: [],
    jobCredits: {},
    updatedAt: new Date().toISOString(),
  };
}

async function readState(userId: string): Promise<BillingState | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`billing/${userId}.json`);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as BillingState;
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
  for (let attempt = 0; attempt < 10; attempt++) {
    const current = (await readState(userId)) ?? emptyState(userId, email);
    const expected = current.version;
    const next = structuredClone(current);
    next.email = email || next.email;
    fn(next);
    next.version = expected + 1;
    next.updatedAt = new Date().toISOString();

    const confirm = (await readState(userId)) ?? emptyState(userId, email);
    if (confirm.version !== expected) continue;

    await writeState(next);

    const saved = await readState(userId);
    if (saved && saved.version === next.version) return saved;
  }
  throw new Error("Could not update billing state (concurrent writes)");
}

function addLot(
  state: BillingState,
  input: {
    amount: number;
    source: CreditSource;
    polarEventId?: string | null;
  }
) {
  const lot: CreditLot = {
    id: randomUUID(),
    source: input.source,
    originalAmount: input.amount,
    remainingAmount: input.amount,
    expiresAt: new Date(
      Date.now() + CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
    polarEventId: input.polarEventId ?? null,
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

export async function getBillingSummary(userId: string, email: string) {
  const state = await ensureBillingUser(userId, email);
  return {
    balance: availableCredits(state),
    freeGranted: state.freeGranted,
    subscription: state.subscription,
    lots: state.lots.filter(
      (lot) => lot.remainingAmount > 0 && new Date(lot.expiresAt) > new Date()
    ),
    transactions: state.transactions.slice(0, 50),
    history: state.history.slice(0, 50),
    polarCustomerId: state.polarCustomerId,
  };
}

export async function setPolarCustomerId(
  userId: string,
  email: string,
  polarCustomerId: string
) {
  return mutate(userId, email, (state) => {
    state.polarCustomerId = polarCustomerId;
  });
}

export async function grantCredits(input: {
  userId: string;
  email: string;
  amount: number;
  source: CreditSource;
  polarEventId: string;
  polarOrderId?: string | null;
  type: string;
  metadata?: Record<string, unknown>;
}) {
  return mutate(input.userId, input.email, (state) => {
    if (
      input.polarEventId &&
      state.transactions.some((tx) => tx.polarEventId === input.polarEventId)
    ) {
      return;
    }
    addLot(state, {
      amount: input.amount,
      source: input.source,
      polarEventId: input.polarEventId,
    });
    const tx: BillingTransaction = {
      id: randomUUID(),
      type: input.type,
      amount: input.amount,
      polarEventId: input.polarEventId,
      polarOrderId: input.polarOrderId ?? null,
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
  polarEventId: string;
  polarOrderId?: string | null;
  jobId?: string | null;
}) {
  return mutate(input.userId, input.email, (state) => {
    if (state.transactions.some((tx) => tx.polarEventId === input.polarEventId)) {
      return;
    }

    if (input.jobId) {
      const job = state.jobCredits[input.jobId];
      if (job?.status === "consumed") {
        state.transactions.unshift({
          id: randomUUID(),
          type: "refund_denied_completed_job",
          amount: 0,
          polarEventId: input.polarEventId,
          polarOrderId: input.polarOrderId ?? null,
          metadata: { jobId: input.jobId },
          createdAt: new Date().toISOString(),
        });
        return;
      }
      if (job?.status === "reserved") {
        addLot(state, {
          amount: job.charged,
          source: "refund_restore",
          polarEventId: input.polarEventId,
        });
        job.status = "restored";
      } else {
        addLot(state, {
          amount: input.amount,
          source: "refund_restore",
          polarEventId: input.polarEventId,
        });
      }
    } else {
      addLot(state, {
        amount: input.amount,
        source: "refund_restore",
        polarEventId: input.polarEventId,
      });
    }

    state.transactions.unshift({
      id: randomUUID(),
      type: "refund",
      amount: input.amount,
      polarEventId: input.polarEventId,
      polarOrderId: input.polarOrderId ?? null,
      metadata: { jobId: input.jobId ?? null },
      createdAt: new Date().toISOString(),
    });
  });
}

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
