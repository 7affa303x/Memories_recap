import { Webhooks } from "@polar-sh/nextjs";
import {
  handleCheckoutUpdated,
  handleOrderPaid,
  handleRefundCreated,
  handleSubscriptionEvent,
} from "@/lib/billing/webhooks";

export const runtime = "nodejs";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET || "",
  onCheckoutUpdated: async (payload) => {
    await handleCheckoutUpdated(payload as never);
  },
  onOrderPaid: async (payload) => {
    await handleOrderPaid(payload as never);
  },
  onSubscriptionCreated: async (payload) => {
    await handleSubscriptionEvent("subscription.created", payload as never);
  },
  onSubscriptionUpdated: async (payload) => {
    await handleSubscriptionEvent("subscription.updated", payload as never);
  },
  onSubscriptionActive: async (payload) => {
    await handleSubscriptionEvent("subscription.active", payload as never);
  },
  onSubscriptionCanceled: async (payload) => {
    await handleSubscriptionEvent("subscription.cancelled", payload as never);
  },
  onSubscriptionRevoked: async (payload) => {
    await handleSubscriptionEvent("subscription.revoked", payload as never);
  },
  onRefundCreated: async (payload) => {
    await handleRefundCreated(payload as never);
  },
});
