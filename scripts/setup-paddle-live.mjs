/**
 * Provision live (or sandbox) Paddle catalog + webhook for Memories Recap.
 *
 * Requires: PADDLE_API_KEY
 * Optional: PADDLE_ENV / NEXT_PUBLIC_PADDLE_ENV = sandbox|production (default production)
 *           NEXT_PUBLIC_APP_URL / AUTH_URL (default https://memories-recap-one.vercel.app)
 *
 * Idempotent: reuses existing products/prices/webhooks/client tokens tagged with product_key.
 */
import { writeFileSync } from "node:fs";
import {
  Environment,
  EventName,
  Paddle,
} from "@paddle/paddle-node-sdk";

const APP_URL = (
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://memories-recap-one.vercel.app"
).replace(/\/$/, "");

const WEBHOOK_URL = `${APP_URL}/api/webhooks/paddle`;

const CATALOG = [
  {
    key: "subscription",
    name: "Pro Monthly",
    description:
      "Monthly Moments for Memories Recap. Cancel anytime. Access until period end.",
    credits: 2000,
    amount: "1700",
    recurring: true,
  },
  {
    key: "credits_small",
    name: "Small Moments Pack",
    description: "500 Moments for Memories Recap. Valid for 90 days.",
    credits: 500,
    amount: "900",
    recurring: false,
  },
  {
    key: "credits_medium",
    name: "Medium Moments Pack",
    description: "2000 Moments for Memories Recap. Valid for 90 days.",
    credits: 2000,
    amount: "2900",
    recurring: false,
  },
  {
    key: "credits_large",
    name: "Large Moments Pack",
    description: "5000 Moments for Memories Recap. Valid for 90 days.",
    credits: 5000,
    amount: "6900",
    recurring: false,
  },
];

const SUBSCRIBED_EVENTS = [
  EventName.TransactionCompleted,
  EventName.SubscriptionActivated,
  EventName.SubscriptionCreated,
  EventName.SubscriptionUpdated,
  EventName.SubscriptionCanceled,
  EventName.SubscriptionPastDue,
  EventName.SubscriptionPaused,
  EventName.SubscriptionResumed,
  EventName.AdjustmentUpdated,
];

async function collect(iterable) {
  const items = [];
  for await (const item of iterable) items.push(item);
  return items;
}

async function main() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    console.error("Missing PADDLE_API_KEY");
    process.exit(1);
  }

  const envName =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ||
    process.env.PADDLE_ENV === "sandbox"
      ? "sandbox"
      : "production";

  const paddle = new Paddle(apiKey, {
    environment:
      envName === "sandbox" ? Environment.sandbox : Environment.production,
  });

  console.log(`Paddle environment: ${envName}`);
  console.log(`App URL: ${APP_URL}`);
  console.log(`Webhook URL: ${WEBHOOK_URL}`);

  const products = await collect(paddle.products.list({ perPage: 50 }));
  const prices = await collect(paddle.prices.list({ perPage: 50 }));

  const priceIds = {};

  for (const item of CATALOG) {
    let product = products.find(
      (p) => p.customData && p.customData.product_key === item.key
    );
    if (!product) {
      product = await paddle.products.create({
        name: item.name,
        description: item.description,
        taxCategory: "saas",
        type: "standard",
        customData: {
          product_key: item.key,
          credits: String(item.credits),
        },
      });
      console.log(`Created product ${item.key}: ${product.id}`);
    } else {
      console.log(`Reusing product ${item.key}: ${product.id}`);
    }

    let price = prices.find(
      (p) =>
        p.productId === product.id &&
        p.customData &&
        p.customData.product_key === item.key &&
        p.status === "active"
    );

    if (!price) {
      price = await paddle.prices.create({
        productId: product.id,
        description: item.name,
        name: item.name,
        type: "standard",
        unitPrice: { amount: item.amount, currencyCode: "USD" },
        billingCycle: item.recurring
          ? { interval: "month", frequency: 1 }
          : null,
        quantity: { minimum: 1, maximum: 1 },
        customData: {
          product_key: item.key,
          credits: String(item.credits),
        },
      });
      console.log(`Created price ${item.key}: ${price.id}`);
    } else {
      console.log(`Reusing price ${item.key}: ${price.id}`);
    }

    priceIds[item.key] = price.id;
  }

  // Client token
  const tokens = await collect(paddle.clientTokens.list({ perPage: 50 }));
  let clientToken = tokens.find(
    (t) => t.status === "active" && t.name === "Memories Recap Web"
  );
  if (!clientToken) {
    clientToken = await paddle.clientTokens.create({
      name: "Memories Recap Web",
      description: "Browser checkout for Memories Recap",
    });
    console.log(`Created client token: ${clientToken.id}`);
  } else {
    console.log(`Reusing client token: ${clientToken.id}`);
  }

  // Notification destination (list returns an array, not a collection)
  const settings = await paddle.notificationSettings.list();
  let webhook = settings.find(
    (s) => s.type === "url" && s.destination === WEBHOOK_URL
  );
  if (!webhook) {
    webhook = await paddle.notificationSettings.create({
      description: "Memories Recap live billing",
      destination: WEBHOOK_URL,
      type: "url",
      subscribedEvents: SUBSCRIBED_EVENTS,
      includeSensitiveFields: false,
    });
    console.log(`Created webhook: ${webhook.id}`);
  } else {
    if (!webhook.active) {
      webhook = await paddle.notificationSettings.update(webhook.id, {
        active: true,
        subscribedEvents: SUBSCRIBED_EVENTS,
      });
      console.log(`Re-activated webhook: ${webhook.id}`);
    } else {
      console.log(`Reusing webhook: ${webhook.id}`);
    }
  }

  const envLines = {
    PADDLE_API_KEY: apiKey,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: clientToken.token,
    PADDLE_NOTIFICATION_WEBHOOK_SECRET: webhook.endpointSecretKey,
    NEXT_PUBLIC_PADDLE_ENV: envName,
    PADDLE_PRICE_SUBSCRIPTION: priceIds.subscription,
    PADDLE_PRICE_CREDITS_SMALL: priceIds.credits_small,
    PADDLE_PRICE_CREDITS_MEDIUM: priceIds.credits_medium,
    PADDLE_PRICE_CREDITS_LARGE: priceIds.credits_large,
    PADDLE_CREDITS_SUBSCRIPTION: "2000",
    PADDLE_CREDITS_SMALL: "500",
    PADDLE_CREDITS_MEDIUM: "2000",
    PADDLE_CREDITS_LARGE: "5000",
    FREE_CREDITS: process.env.FREE_CREDITS || "200",
    CREDIT_EXPIRY_DAYS: process.env.CREDIT_EXPIRY_DAYS || "90",
    MIN_JOB_CREDITS: process.env.MIN_JOB_CREDITS || "10",
    NEXT_PUBLIC_APP_URL: APP_URL,
  };

  const outPath = "/tmp/paddle-live.env";
  writeFileSync(
    outPath,
    Object.entries(envLines)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );

  console.log("\n=== Live env ready ===");
  for (const [k, v] of Object.entries(envLines)) {
    if (k === "PADDLE_API_KEY" || k === "PADDLE_NOTIFICATION_WEBHOOK_SECRET") {
      console.log(`${k}=***`);
    } else {
      console.log(`${k}=${v}`);
    }
  }
  console.log(`\nWrote ${outPath}`);
  console.log(
    "\nManual dashboard check still required for Paddle verification:"
  );
  console.log(
    `  Checkout → Checkout settings → Default payment link = ${APP_URL}/billing`
  );
  console.log("  Ensure live account domain / website is approved.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
