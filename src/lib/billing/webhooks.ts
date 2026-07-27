import {
  grantCredits,
  markWebhookProcessed,
  restoreCreditsForRefund,
  setPolarCustomerId,
  upsertSubscription,
} from "@/lib/billing/credits";
import {
  PRODUCT_CREDITS,
  productKeyFromId,
} from "@/lib/billing/config";

function customerExternalId(customer: {
  externalId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  if (customer.externalId) return customer.externalId;
  const meta = customer.metadata ?? {};
  if (typeof meta.userId === "string") return meta.userId;
  return null;
}

function customerEmail(customer: { email?: string | null }, fallback?: string) {
  return customer.email || fallback || "unknown@memoryrecap.app";
}

async function withIdempotency(eventId: string, type: string, fn: () => Promise<void>) {
  const fresh = await markWebhookProcessed(eventId, type);
  if (!fresh) return;
  await fn();
}

export async function handleOrderPaid(payload: {
  data: {
    id: string;
    customer?: {
      id?: string;
      externalId?: string | null;
      email?: string | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    product?: { id?: string } | null;
    productId?: string | null;
    subscription?: { id?: string } | null;
    metadata?: Record<string, unknown> | null;
  };
}) {
  const order = payload.data;
  const eventId = `order.paid:${order.id}`;
  await withIdempotency(eventId, "order.paid", async () => {
    const customer = order.customer;
    if (!customer) return;
    const userId = customerExternalId(customer);
    if (!userId) return;
    const email = customerEmail(customer);
    if (customer.id) {
      await setPolarCustomerId(userId, email, customer.id);
    }

    const productId = order.product?.id || order.productId || "";
    const key = productKeyFromId(productId);
    if (!key) return;

    // Subscription renewals are handled on subscription events; packs grant here.
    if (key === "subscription") {
      if (!order.subscription?.id) {
        // First subscription order also grants cycle credits once.
        await grantCredits({
          userId,
          email,
          amount: PRODUCT_CREDITS.subscription,
          source: "subscription",
          polarEventId: eventId,
          polarOrderId: order.id,
          type: "subscription_cycle_grant",
          metadata: { productId },
        });
      }
      return;
    }

    await grantCredits({
      userId,
      email,
      amount: PRODUCT_CREDITS[key],
      source: "pack",
      polarEventId: eventId,
      polarOrderId: order.id,
      type: `pack_${key}`,
      metadata: { productId },
    });
  });
}

export async function handleCheckoutUpdated(payload: {
  data: {
    id: string;
    status?: string;
    customerId?: string | null;
    customerExternalId?: string | null;
    customerEmail?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}) {
  const checkout = payload.data;
  if (checkout.status !== "succeeded" && checkout.status !== "complete") return;

  const eventId = `checkout.completed:${checkout.id}`;
  await withIdempotency(eventId, "checkout.completed", async () => {
    const userId =
      checkout.customerExternalId ||
      (typeof checkout.metadata?.userId === "string"
        ? checkout.metadata.userId
        : null);
    if (!userId) return;
    const email =
      checkout.customerEmail ||
      (typeof checkout.metadata?.email === "string"
        ? checkout.metadata.email
        : "unknown@memoryrecap.app");
    if (checkout.customerId) {
      await setPolarCustomerId(userId, email, checkout.customerId);
    }
  });
}

export async function handleSubscriptionEvent(
  type: string,
  payload: {
    data: {
      id: string;
      status?: string;
      cancelAtPeriodEnd?: boolean | null;
      currentPeriodStart?: string | Date | null;
      currentPeriodEnd?: string | Date | null;
      productId?: string | null;
      product?: { id?: string } | null;
      customer?: {
        id?: string;
        externalId?: string | null;
        email?: string | null;
        metadata?: Record<string, unknown> | null;
      } | null;
    };
  }
) {
  const sub = payload.data;
  const eventId = `${type}:${sub.id}:${sub.status}:${sub.currentPeriodEnd}`;
  await withIdempotency(eventId, type, async () => {
    const customer = sub.customer;
    if (!customer) return;
    const userId = customerExternalId(customer);
    if (!userId) return;
    const email = customerEmail(customer);
    if (customer.id) await setPolarCustomerId(userId, email, customer.id);

    const productId = sub.product?.id || sub.productId || "";
    const periodStart = sub.currentPeriodStart
      ? new Date(sub.currentPeriodStart).toISOString()
      : null;
    const periodEnd = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toISOString()
      : null;

    await upsertSubscription({
      userId,
      email,
      subscription: {
        id: sub.id,
        polarSubscriptionId: sub.id,
        polarProductId: productId,
        status: sub.status || type,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
        updatedAt: new Date().toISOString(),
      },
    });

    if (
      (type === "subscription.created" || type === "subscription.active") &&
      productKeyFromId(productId) === "subscription"
    ) {
      await grantCredits({
        userId,
        email,
        amount: PRODUCT_CREDITS.subscription,
        source: "subscription",
        polarEventId: `sub-grant:${sub.id}:${periodStart || "start"}`,
        type: "subscription_cycle_grant",
        metadata: { subscriptionId: sub.id, productId },
      });
    }

    // Renewals often arrive as subscription.updated with a new period.
    if (type === "subscription.updated" && periodStart) {
      await grantCredits({
        userId,
        email,
        amount: PRODUCT_CREDITS.subscription,
        source: "subscription",
        polarEventId: `sub-grant:${sub.id}:${periodStart}`,
        type: "subscription_cycle_grant",
        metadata: { subscriptionId: sub.id, productId },
      });
    }
  });
}

export async function handleRefundCreated(payload: {
  data: {
    id: string;
    amount?: number | null;
    orderId?: string | null;
    customer?: {
      id?: string;
      externalId?: string | null;
      email?: string | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    metadata?: Record<string, unknown> | null;
  };
}) {
  const refund = payload.data;
  const eventId = `refund.created:${refund.id}`;
  await withIdempotency(eventId, "refund.created", async () => {
    const customer = refund.customer;
    if (!customer) return;
    const userId = customerExternalId(customer);
    if (!userId) return;
    const email = customerEmail(customer);
    const jobId =
      typeof refund.metadata?.jobId === "string" ? refund.metadata.jobId : null;

    // Credit packs: restore by configured pack size when amount unknown.
    // Prefer explicit metadata.credits when present.
    const credits =
      typeof refund.metadata?.credits === "number"
        ? refund.metadata.credits
        : typeof refund.metadata?.credits === "string"
          ? Number(refund.metadata.credits)
          : 0;

    await restoreCreditsForRefund({
      userId,
      email,
      amount: Number.isFinite(credits) && credits > 0 ? credits : 0,
      polarEventId: eventId,
      polarOrderId: refund.orderId ?? null,
      jobId,
    });
  });
}
