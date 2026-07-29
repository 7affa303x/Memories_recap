import {
  grantCredits,
  markWebhookProcessed,
  restoreCreditsForRefund,
  upsertSubscription,
} from "@/lib/billing/credits";
import { PRODUCT_CREDITS } from "@/lib/billing/config";
import { productKeyFromGumroad } from "@/lib/billing/gumroad";
import type { ProductKey } from "@/lib/billing/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function str(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickUrlParam(
  urlParams: Record<string, unknown> | null,
  ...keys: string[]
) {
  if (!urlParams) return null;
  for (const key of keys) {
    const direct = str(urlParams[key]);
    if (direct) return direct;
    // Gumroad sometimes nests or stringifies
    const alt = str(urlParams[`url_params[${key}]`]);
    if (alt) return alt;
  }
  return null;
}

async function withIdempotency(
  eventId: string,
  type: string,
  fn: () => Promise<void>
) {
  const fresh = await markWebhookProcessed(eventId, type);
  if (!fresh) return;
  await fn();
}

/**
 * Handle Gumroad Ping (form-urlencoded) and resource_subscription JSON/form payloads.
 */
export async function handleGumroadSalePayload(
  raw: Record<string, unknown>
) {
  const saleId =
    str(raw.sale_id) ||
    str(raw.id) ||
    str(raw.purchase_id) ||
    `unknown-${Date.now()}`;

  let urlParams = asRecord(raw.url_params);
  if (!urlParams && typeof raw.url_params === "string") {
    try {
      urlParams = JSON.parse(raw.url_params) as Record<string, unknown>;
    } catch {
      urlParams = null;
    }
  }
  // Flatten common Ping field shapes
  if (!urlParams) {
    urlParams = {};
    for (const [key, value] of Object.entries(raw)) {
      const match = key.match(/^url_params\[(.+)\]$/);
      if (match) urlParams[match[1]] = value;
    }
    if (Object.keys(urlParams).length === 0) urlParams = null;
  }

  const userId =
    pickUrlParam(urlParams, "user_id", "userId", "userid") ||
    str(raw.user_id) ||
    str(raw.userid);
  const email =
    str(raw.email) ||
    pickUrlParam(urlParams, "email") ||
    "unknown@memoryrecap.app";

  if (!userId) {
    console.warn("gumroad sale missing user_id", { saleId, email });
    return { ok: false, reason: "missing_user_id" as const };
  }

  const productId = str(raw.product_id) || str(raw.product_permalink);
  const permalink =
    str(raw.product_permalink) ||
    str(raw.short_product_id) ||
    str(raw.permalink);
  const productName = str(raw.product_name) || str(raw.name);
  const metaProduct = pickUrlParam(urlParams, "product") as ProductKey | null;

  const key =
    metaProduct ||
    productKeyFromGumroad({
      productId,
      permalink,
      productName,
    });

  if (!key) {
    console.warn("gumroad sale unknown product", {
      saleId,
      productId,
      permalink,
      productName,
    });
    return { ok: false, reason: "unknown_product" as const };
  }

  const eventId = `gumroad.sale:${saleId}`;
  await withIdempotency(eventId, "gumroad.sale", async () => {
    if (key === "subscription") {
      const periodEnd = new Date(
        Date.now() + 35 * 24 * 60 * 60 * 1000
      ).toISOString();
      await upsertSubscription({
        userId,
        email,
        subscription: {
          id: saleId,
          creemSubscriptionId: `gumroad:${saleId}`,
          creemProductId: productId || permalink || key,
          status: "active",
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: new Date().toISOString(),
        },
      });
      await grantCredits({
        userId,
        email,
        amount: PRODUCT_CREDITS.subscription,
        source: "subscription",
        creemEventId: `gumroad-sub-grant:${saleId}`,
        creemOrderId: saleId,
        type: "subscription_cycle_grant",
        metadata: { provider: "gumroad", productId, permalink },
      });
      return;
    }

    await grantCredits({
      userId,
      email,
      amount: PRODUCT_CREDITS[key],
      source: "pack",
      creemEventId: eventId,
      creemOrderId: saleId,
      type: `pack_${key}`,
      metadata: { provider: "gumroad", productId, permalink },
    });
  });

  return { ok: true as const, key, userId };
}

export async function handleGumroadRefundPayload(
  raw: Record<string, unknown>
) {
  const saleId = str(raw.sale_id) || str(raw.id) || "unknown";
  let urlParams = asRecord(raw.url_params);
  if (!urlParams) {
    urlParams = {};
    for (const [key, value] of Object.entries(raw)) {
      const match = key.match(/^url_params\[(.+)\]$/);
      if (match) urlParams[match[1]] = value;
    }
    if (Object.keys(urlParams).length === 0) urlParams = null;
  }
  const userId =
    pickUrlParam(urlParams, "user_id", "userId") || str(raw.user_id);
  if (!userId) return;

  const email = str(raw.email) || "unknown@memoryrecap.app";
  const metaProduct = pickUrlParam(urlParams, "product") as ProductKey | null;
  const key =
    metaProduct ||
    productKeyFromGumroad({
      productId: str(raw.product_id),
      permalink: str(raw.product_permalink),
      productName: str(raw.product_name),
    });
  const amount = key ? PRODUCT_CREDITS[key] : 0;
  const eventId = `gumroad.refund:${saleId}`;
  await withIdempotency(eventId, "gumroad.refund", async () => {
    await restoreCreditsForRefund({
      userId,
      email,
      amount,
      creemEventId: eventId,
      creemOrderId: saleId,
    });
  });
}

export async function handleGumroadSubscriptionLifecycle(
  type: string,
  raw: Record<string, unknown>
) {
  const saleId = str(raw.sale_id) || str(raw.subscription_id) || str(raw.id);
  if (!saleId) return;
  let urlParams = asRecord(raw.url_params);
  const userId =
    pickUrlParam(urlParams, "user_id", "userId") || str(raw.user_id);
  if (!userId) return;
  const email = str(raw.email) || "unknown@memoryrecap.app";

  const status =
    type.includes("ended") || type.includes("cancellation")
      ? "canceled"
      : type.includes("restarted")
        ? "active"
        : str(raw.status) || "active";

  await upsertSubscription({
    userId,
    email,
    subscription: {
      id: saleId,
      creemSubscriptionId: `gumroad:${saleId}`,
      creemProductId: str(raw.product_id) || "subscription",
      status,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: status === "canceled",
      updatedAt: new Date().toISOString(),
    },
  });
}
