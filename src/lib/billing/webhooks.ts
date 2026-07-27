import {
  grantCredits,
  markWebhookProcessed,
  restoreCreditsForRefund,
  setPaddleCustomerId,
  upsertSubscription,
} from "@/lib/billing/credits";
import {
  PRODUCT_CREDITS,
  productKeyFromPriceId,
} from "@/lib/billing/config";
import { getPaddleClient } from "@/lib/billing/paddle";
import type { ProductKey } from "@/lib/billing/types";
import type {
  AdjustmentNotification,
  EventEntity,
  SubscriptionNotification,
  TransactionNotification,
} from "@paddle/paddle-node-sdk";
import { EventName } from "@paddle/paddle-node-sdk";

type CustomData = Record<string, unknown> | null | undefined;

function customString(data: CustomData, key: string) {
  if (!data) return null;
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function userFromCustomData(data: CustomData) {
  return customString(data, "userId") || customString(data, "user_id");
}

function emailFromCustomData(data: CustomData, fallback?: string | null) {
  return (
    customString(data, "email") ||
    fallback ||
    "unknown@memoryrecap.app"
  );
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

function priceIdsFromTransaction(tx: TransactionNotification) {
  return tx.items
    .map((item) => item.price?.id)
    .filter((id): id is string => Boolean(id));
}

function productKeyFromTransaction(tx: TransactionNotification): ProductKey | null {
  const fromCustom = customString(tx.customData, "product") as ProductKey | null;
  if (
    fromCustom &&
    ["subscription", "credits_small", "credits_medium", "credits_large"].includes(
      fromCustom
    )
  ) {
    return fromCustom;
  }
  for (const priceId of priceIdsFromTransaction(tx)) {
    const key = productKeyFromPriceId(priceId);
    if (key) return key;
  }
  return null;
}

function priceIdFromSubscription(sub: SubscriptionNotification) {
  return sub.items[0]?.price?.id || "";
}

async function resolveUserFromCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  try {
    const paddle = getPaddleClient();
    const customer = await paddle.customers.get(customerId);
    const userId = userFromCustomData(customer.customData);
    if (!userId) return null;
    return {
      userId,
      email: emailFromCustomData(customer.customData, customer.email),
    };
  } catch {
    return null;
  }
}

export async function handleTransactionCompleted(tx: TransactionNotification) {
  const eventId = `transaction.completed:${tx.id}`;
  await withIdempotency(eventId, EventName.TransactionCompleted, async () => {
    let userId = userFromCustomData(tx.customData);
    let email = emailFromCustomData(tx.customData);
    if (!userId) {
      const resolved = await resolveUserFromCustomer(tx.customerId);
      if (!resolved) return;
      userId = resolved.userId;
      email = resolved.email;
    }
    if (tx.customerId) {
      await setPaddleCustomerId(userId, email, tx.customerId);
    }

    const key = productKeyFromTransaction(tx);
    if (!key) return;

    // Subscription cycle grants are handled on subscription.activated / renewals.
    if (key === "subscription") return;

    await grantCredits({
      userId,
      email,
      amount: PRODUCT_CREDITS[key],
      source: "pack",
      paddleEventId: eventId,
      paddleTransactionId: tx.id,
      type: `pack_${key}`,
      metadata: { priceIds: priceIdsFromTransaction(tx) },
    });
  });
}

export async function handleSubscriptionEvent(
  type: EventName,
  sub: SubscriptionNotification
) {
  const periodStart = sub.currentBillingPeriod?.startsAt || null;
  const periodEnd = sub.currentBillingPeriod?.endsAt || null;
  const eventId = `${type}:${sub.id}:${sub.status}:${periodEnd || "none"}`;

  await withIdempotency(eventId, type, async () => {
    let userId = userFromCustomData(sub.customData);
    let email = emailFromCustomData(sub.customData);
    if (!userId) {
      const resolved = await resolveUserFromCustomer(sub.customerId);
      if (!resolved) return;
      userId = resolved.userId;
      email = resolved.email;
    }
    if (sub.customerId) {
      await setPaddleCustomerId(userId, email, sub.customerId);
    }

    const priceId = priceIdFromSubscription(sub);
    const cancelAtPeriodEnd =
      sub.scheduledChange?.action === "cancel" || Boolean(sub.canceledAt);

    await upsertSubscription({
      userId,
      email,
      subscription: {
        id: sub.id,
        paddleSubscriptionId: sub.id,
        paddlePriceId: priceId,
        status: sub.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
        updatedAt: new Date().toISOString(),
      },
    });

    const isActiveGrant =
      type === EventName.SubscriptionActivated ||
      type === EventName.SubscriptionCreated ||
      (type === EventName.SubscriptionUpdated &&
        (sub.status === "active" || sub.status === "trialing"));

    if (isActiveGrant && productKeyFromPriceId(priceId) === "subscription") {
      await grantCredits({
        userId,
        email,
        amount: PRODUCT_CREDITS.subscription,
        source: "subscription",
        paddleEventId: `sub-grant:${sub.id}:${periodStart || "start"}`,
        type: "subscription_cycle_grant",
        metadata: { subscriptionId: sub.id, priceId },
      });
    }
  });
}

export async function handleAdjustmentUpdated(adj: AdjustmentNotification) {
  if (adj.action !== "refund") return;
  if (adj.status !== "approved") return;

  const eventId = `adjustment.approved:${adj.id}`;
  await withIdempotency(eventId, EventName.AdjustmentUpdated, async () => {
    try {
      const paddle = getPaddleClient();
      const tx = await paddle.transactions.get(adj.transactionId);
      const userId = userFromCustomData(tx.customData);
      if (!userId) return;
      const email = emailFromCustomData(tx.customData);
      const product = customString(tx.customData, "product") as ProductKey | null;
      const amount =
        product && product !== "subscription"
          ? PRODUCT_CREDITS[product]
          : product === "subscription"
            ? PRODUCT_CREDITS.subscription
            : 0;

      await restoreCreditsForRefund({
        userId,
        email,
        amount,
        paddleEventId: eventId,
        paddleTransactionId: adj.transactionId,
      });
    } catch (error) {
      console.error("adjustment restore failed", error);
    }
  });
}

export async function handlePaddleEvent(event: EventEntity) {
  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data as TransactionNotification);
      break;
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
    case EventName.SubscriptionPastDue:
    case EventName.SubscriptionPaused:
    case EventName.SubscriptionResumed:
      await handleSubscriptionEvent(
        event.eventType,
        event.data as SubscriptionNotification
      );
      break;
    case EventName.AdjustmentUpdated:
      await handleAdjustmentUpdated(event.data as AdjustmentNotification);
      break;
    default:
      break;
  }
}
