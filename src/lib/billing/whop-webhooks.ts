import {
  grantCredits,
  isWebhookProcessed,
  markWebhookProcessed,
  restoreCreditsForRefund,
  setCreemCustomerId,
  upsertSubscription,
} from "@/lib/billing/credits";
import { PRODUCT_CREDITS } from "@/lib/billing/config";
import { isBillingSelfPurchase } from "@/lib/billing/self-purchase";
import { isSubscriptionProduct } from "@/lib/billing/pricing";
import { productKeyFromWhopIds } from "@/lib/billing/whop";
import type { ProductKey } from "@/lib/billing/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function str(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metaString(meta: unknown, key: string) {
  const obj = asRecord(meta);
  if (!obj) return null;
  return str(obj[key]);
}

async function withIdempotency(
  eventId: string,
  type: string,
  fn: () => Promise<void>
) {
  if (await isWebhookProcessed(eventId)) return;
  await fn();
  await markWebhookProcessed(eventId, type);
}

function resolveProduct(payload: Record<string, unknown>): {
  key: ProductKey | null;
  interval: "monthly" | "annual";
  credits: number | null;
} {
  const metadata = asRecord(payload.metadata) || asRecord(
    asRecord(payload.plan)?.metadata
  );
  const productId =
    str(asRecord(payload.product)?.id) ||
    str(payload.product_id) ||
    str(asRecord(asRecord(payload.plan)?.product)?.id) ||
    str(asRecord(payload.plan)?.product_id);
  const planId = str(asRecord(payload.plan)?.id) || str(payload.plan_id);
  const key = productKeyFromWhopIds({
    productId,
    planId,
    metadataProduct: metaString(metadata, "product"),
  });
  const intervalRaw = metaString(metadata, "interval");
  const interval =
    intervalRaw === "annual" || intervalRaw === "yearly" ? "annual" : "monthly";
  const creditsRaw = metaString(metadata, "credits");
  const credits = creditsRaw && Number.isFinite(Number(creditsRaw))
    ? Number(creditsRaw)
    : key
      ? interval === "annual" && isSubscriptionProduct(key)
        ? PRODUCT_CREDITS[key] * 12
        : PRODUCT_CREDITS[key]
      : null;
  return { key, interval, credits };
}

function userFromPayload(payload: Record<string, unknown>) {
  const metadata = asRecord(payload.metadata);
  const user =
    asRecord(payload.user) ||
    asRecord(payload.member) ||
    asRecord(asRecord(payload.membership)?.user);
  const userId =
    metaString(metadata, "userId") ||
    metaString(metadata, "user_id") ||
    str(payload.user_id);
  const email =
    metaString(metadata, "email") ||
    str(user?.email) ||
    str(payload.email) ||
    "unknown@memoryrecap.app";
  const customerId =
    str(asRecord(payload.member)?.id) ||
    str(user?.id) ||
    str(payload.member_id);
  return { userId, email, customerId };
}

/**
 * payment.succeeded — packs + first subscription charge.
 */
export async function handleWhopPaymentSucceeded(
  payload: Record<string, unknown>
) {
  const paymentId = str(payload.id) || `pay-${Date.now()}`;
  const eventId = `whop.payment.succeeded:${paymentId}`;

  await withIdempotency(eventId, "whop.payment.succeeded", async () => {
    const { userId, email, customerId } = userFromPayload(payload);
    if (!userId) {
      console.warn("whop payment missing userId metadata", { paymentId });
      return;
    }
    if (isBillingSelfPurchase(email)) {
      console.warn("whop payment skipped self-purchase", { paymentId, email });
      return;
    }
    if (customerId) await setCreemCustomerId(userId, email, customerId);

    const { key, interval, credits } = resolveProduct(payload);
    if (!key || !credits) {
      console.warn("whop payment unresolved product", { paymentId, key });
      return;
    }

    if (isSubscriptionProduct(key)) {
      const now = new Date();
      const periodEnd = new Date(now);
      if (interval === "annual") periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
      else periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
      const membershipIdOrPayment =
        str(payload.membership_id) || str(asRecord(payload.membership)?.id) || paymentId;

      await upsertSubscription({
        userId,
        email,
        subscription: {
          id: membershipIdOrPayment,
          creemSubscriptionId: membershipIdOrPayment,
          creemProductId: key,
          status: "active",
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          cancelAtPeriodEnd: false,
          updatedAt: now.toISOString(),
        },
      });

      await grantCredits({
        userId,
        email,
        amount: credits,
        source: "subscription",
        creemEventId: eventId,
        creemOrderId: paymentId,
        type:
          key === "subscription_ultra"
            ? "subscription_ultra_grant"
            : "subscription_grant",
        metadata: { product: key, interval, provider: "whop" },
      });
      return;
    }

    await grantCredits({
      userId,
      email,
      amount: credits,
      source: "pack",
      creemEventId: eventId,
      creemOrderId: paymentId,
      type: `pack_${key}`,
      metadata: { product: key, productKey: key, provider: "whop" },
    });
  });
}

export async function handleWhopMembershipDeactivated(
  payload: Record<string, unknown>
) {
  const membershipId = str(payload.id) || `mem-${Date.now()}`;
  const eventId = `whop.membership.deactivated:${membershipId}`;
  await withIdempotency(eventId, "whop.membership.deactivated", async () => {
    const { userId, email } = userFromPayload(payload);
    if (!userId) return;
    await upsertSubscription({
      userId,
      email,
      subscription: {
        id: membershipId,
        creemSubscriptionId: membershipId,
        creemProductId:
          metaString(payload.metadata, "product") || "subscription",
        status: "canceled",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: true,
        updatedAt: new Date().toISOString(),
      },
    });
  });
}

export async function handleWhopRefundCreated(
  payload: Record<string, unknown>
) {
  const refundId = str(payload.id) || `ref-${Date.now()}`;
  const payment = asRecord(payload.payment) || payload;
  const paymentId =
    str(asRecord(payload.payment)?.id) ||
    str(payload.payment_id) ||
    refundId;
  const eventId = `whop.refund:${refundId}`;
  await withIdempotency(eventId, "whop.refund", async () => {
    const { userId, email } = userFromPayload(payment);
    if (!userId) return;
    const { credits } = resolveProduct(payment);
    if (!credits || credits <= 0) return;
    await restoreCreditsForRefund({
      userId,
      email,
      amount: credits,
      creemEventId: eventId,
      creemOrderId: paymentId,
    });
  });
}
