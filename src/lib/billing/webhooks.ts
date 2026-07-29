import {
  grantCredits,
  markWebhookProcessed,
  restoreCreditsForRefund,
  setCreemCustomerId,
  upsertSubscription,
} from "@/lib/billing/credits";
import {
  PRODUCT_CREDITS,
  productKeyFromId,
} from "@/lib/billing/config";
import type { ProductKey } from "@/lib/billing/types";

type Meta = Record<string, unknown> | null | undefined;

function metaString(data: Meta, key: string) {
  if (!data) return null;
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function productIdFrom(value: unknown): string {
  if (typeof value === "string") return value;
  const obj = asRecord(value);
  if (obj && typeof obj.id === "string") return obj.id;
  return "";
}

function customerIdFrom(value: unknown): string | null {
  if (typeof value === "string") return value;
  const obj = asRecord(value);
  if (obj && typeof obj.id === "string") return obj.id;
  return null;
}

function customerEmailFrom(value: unknown, fallback?: string | null) {
  const obj = asRecord(value);
  if (obj && typeof obj.email === "string") return obj.email;
  return fallback || "unknown@memoryrecap.app";
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

export async function handleCheckoutCompleted(payload: {
  id?: string;
  request_id?: string | null;
  metadata?: Meta;
  customer?: unknown;
  product?: unknown;
  order?: unknown;
  subscription?: unknown;
}) {
  const eventId = `checkout.completed:${payload.id || "unknown"}`;
  await withIdempotency(eventId, "checkout.completed", async () => {
    const metadata = payload.metadata;
    const userId =
      metaString(metadata, "userId") ||
      metaString(metadata, "user_id") ||
      (typeof payload.request_id === "string" ? payload.request_id : null);
    if (!userId) return;

    const email =
      metaString(metadata, "email") ||
      customerEmailFrom(payload.customer);
    const customerId = customerIdFrom(payload.customer);
    if (customerId) await setCreemCustomerId(userId, email, customerId);

    const productId = productIdFrom(payload.product);
    const key =
      (metaString(metadata, "product") as ProductKey | null) ||
      productKeyFromId(productId);
    if (!key) return;

    const order = asRecord(payload.order);
    const orderId =
      (order && typeof order.id === "string" && order.id) ||
      payload.id ||
      null;

    if (key === "subscription") {
      // Cycle grant handled on subscription.active / subscription.paid
      return;
    }

    await grantCredits({
      userId,
      email,
      amount: PRODUCT_CREDITS[key],
      source: "pack",
      creemEventId: eventId,
      creemOrderId: orderId,
      type: `pack_${key}`,
      metadata: { productId },
    });
  });
}

export async function handleSubscriptionEvent(
  type: string,
  payload: {
    id?: string;
    status?: string;
    product?: unknown;
    customer?: unknown;
    metadata?: Meta;
    current_period_start_date?: string | null;
    current_period_end_date?: string | null;
    canceled_at?: string | null;
  }
) {
  const periodStart = payload.current_period_start_date || null;
  const periodEnd = payload.current_period_end_date || null;
  const eventId = `${type}:${payload.id}:${payload.status}:${periodEnd || "none"}`;

  await withIdempotency(eventId, type, async () => {
    const metadata = payload.metadata;
    const userId =
      metaString(metadata, "userId") || metaString(metadata, "user_id");
    if (!userId) return;
    const email =
      metaString(metadata, "email") ||
      customerEmailFrom(payload.customer);
    const customerId = customerIdFrom(payload.customer);
    if (customerId) await setCreemCustomerId(userId, email, customerId);

    const productId = productIdFrom(payload.product);
    await upsertSubscription({
      userId,
      email,
      subscription: {
        id: payload.id || "",
        creemSubscriptionId: payload.id || "",
        creemProductId: productId,
        status: payload.status || type,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: Boolean(payload.canceled_at) || type.includes("cancel"),
        updatedAt: new Date().toISOString(),
      },
    });

    const shouldGrant =
      type === "subscription.active" ||
      type === "subscription.paid" ||
      type === "subscription.update";

    if (shouldGrant && productKeyFromId(productId) === "subscription") {
      await grantCredits({
        userId,
        email,
        amount: PRODUCT_CREDITS.subscription,
        source: "subscription",
        creemEventId: `sub-grant:${payload.id}:${periodStart || "start"}`,
        type: "subscription_cycle_grant",
        metadata: { subscriptionId: payload.id, productId },
      });
    }
  });
}

export async function handleRefundCreated(payload: {
  id?: string;
  metadata?: Meta;
  customer?: unknown;
  order?: unknown;
  refund_amount?: number;
}) {
  const eventId = `refund.created:${payload.id || "unknown"}`;
  await withIdempotency(eventId, "refund.created", async () => {
    const metadata = payload.metadata;
    const userId =
      metaString(metadata, "userId") || metaString(metadata, "user_id");
    if (!userId) return;
    const email =
      metaString(metadata, "email") ||
      customerEmailFrom(payload.customer);
    const product = metaString(metadata, "product") as ProductKey | null;
    const amount =
      product && product in PRODUCT_CREDITS
        ? PRODUCT_CREDITS[product]
        : 0;
    const order = asRecord(payload.order);
    const orderId =
      (order && typeof order.id === "string" && order.id) || null;

    await restoreCreditsForRefund({
      userId,
      email,
      amount,
      creemEventId: eventId,
      creemOrderId: orderId,
    });
  });
}

export async function handleCreemWebhookEvent(event: {
  id?: string;
  eventType?: string;
  type?: string;
  object?: Record<string, unknown>;
  data?: Record<string, unknown>;
}) {
  const type = event.eventType || event.type || "";
  const payload = (event.object || event.data || {}) as Record<string, unknown>;

  switch (type) {
    case "checkout.completed":
      await handleCheckoutCompleted(payload as never);
      break;
    case "subscription.active":
    case "subscription.paid":
    case "subscription.canceled":
    case "subscription.scheduled_cancel":
    case "subscription.past_due":
    case "subscription.expired":
    case "subscription.paused":
    case "subscription.update":
    case "subscription.trialing":
      await handleSubscriptionEvent(type, payload as never);
      break;
    case "refund.created":
      await handleRefundCreated(payload as never);
      break;
    default:
      break;
  }
}
