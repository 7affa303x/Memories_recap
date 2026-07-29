/**
 * Provision Gumroad products + sale webhooks for Memories Recap.
 *
 * Requires: GUMROAD_ACCESS_TOKEN
 * Optional: GUMROAD_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL / AUTH_URL
 *
 * Usage:
 *   GUMROAD_ACCESS_TOKEN=xxx node --env-file=.env.local scripts/setup-gumroad.mjs
 *
 * Writes scripts/gumroad-env.generated.txt (safe to copy into Vercel env — no bank data).
 */
import { writeFileSync } from "node:fs";

const token = process.env.GUMROAD_ACCESS_TOKEN;
if (!token) {
  console.error("Missing GUMROAD_ACCESS_TOKEN");
  process.exit(1);
}

const appUrl = (
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://memories-recap-one.vercel.app"
).replace(/\/$/, "");

const webhookSecret =
  process.env.GUMROAD_WEBHOOK_SECRET ||
  `gr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

const postUrl = `${appUrl}/api/webhooks/gumroad?token=${encodeURIComponent(webhookSecret)}`;

const CATALOG = [
  {
    key: "subscription",
    name: "Memories Recap Pro Monthly",
    description:
      "<p>Pro monthly for Memories Recap: stronger AI, 4K, highlights, 90-day archive, no overlay watermark.</p>",
    price: 1700,
    permalink: "memories-recap-pro-monthly",
    native_type: "membership",
    subscription_duration: "monthly",
  },
  {
    key: "credits_small",
    name: "Memories Recap · 500 credits",
    description: "<p>500 processing credits (~500 MB). Valid 90 days.</p>",
    price: 900,
    permalink: "memories-recap-credits-500",
    native_type: "digital",
  },
  {
    key: "credits_medium",
    name: "Memories Recap · 2000 credits",
    description: "<p>2000 processing credits. Valid 90 days.</p>",
    price: 2900,
    permalink: "memories-recap-credits-2000",
    native_type: "digital",
  },
  {
    key: "credits_large",
    name: "Memories Recap · 5000 credits",
    description: "<p>5000 processing credits. Valid 90 days.</p>",
    price: 6900,
    permalink: "memories-recap-credits-5000",
    native_type: "digital",
  },
];

async function api(method, path, fields = {}) {
  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    body.set(k, String(v));
  }
  const url =
    method === "GET"
      ? `https://api.gumroad.com/v2${path}?${body}`
      : `https://api.gumroad.com/v2${path}`;
  const res = await fetch(url, {
    method,
    headers:
      method === "GET"
        ? undefined
        : { "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body.toString(),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `${method} ${path} failed (${res.status})`);
  }
  return json;
}

async function main() {
  console.log("Listing existing Gumroad products…");
  const listed = await api("GET", "/products");
  const existing = listed.products || [];

  const envLines = [
    "BILLING_PROVIDER=gumroad",
    `GUMROAD_ACCESS_TOKEN=${token}`,
    `GUMROAD_WEBHOOK_SECRET=${webhookSecret}`,
  ];

  for (const item of CATALOG) {
    let product = existing.find((p) => p.custom_permalink === item.permalink);

    if (!product) {
      console.log(`Creating ${item.key}…`);
      const created = await api("POST", "/products", {
        name: item.name,
        description: item.description,
        price: item.price,
        price_currency_type: "usd",
        custom_permalink: item.permalink,
        native_type: item.native_type,
        subscription_duration: item.subscription_duration,
        refund_period: "14",
      });
      product = created.product;
    } else {
      console.log(`Reusing existing ${item.key}: ${product.id}`);
    }

    if (product && !product.published) {
      try {
        console.log(`Publishing ${item.key}…`);
        await api("PUT", `/products/${product.id}/enable`);
      } catch (err) {
        console.warn(
          `Could not publish ${item.key}:`,
          err instanceof Error ? err.message : err
        );
        console.warn(
          "→ Connect a payout method in Gumroad Settings → Payouts, then re-run."
        );
      }
    }

    const permalink =
      product?.custom_permalink ||
      item.permalink ||
      (product?.short_url || "").split("/").pop();

    const envKey = {
      subscription: "SUBSCRIPTION",
      credits_small: "CREDITS_SMALL",
      credits_medium: "CREDITS_MEDIUM",
      credits_large: "CREDITS_LARGE",
    }[item.key];

    envLines.push(`GUMROAD_PRODUCT_${envKey}=${product.id}`);
    envLines.push(`GUMROAD_PERMALINK_${envKey}=${permalink}`);
    console.log(`  id=${product.id} permalink=${permalink}`);
  }

  const resources = [
    "sale",
    "refund",
    "cancellation",
    "subscription_updated",
    "subscription_ended",
    "subscription_restarted",
  ];
  for (const resource of resources) {
    try {
      console.log(`Subscribing webhook: ${resource}`);
      await api("PUT", "/resource_subscriptions", {
        resource_name: resource,
        post_url: postUrl,
      });
    } catch (err) {
      console.warn(
        `Webhook ${resource} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  envLines.push(
    "",
    "# Also set Ping URL in Gumroad Settings → Advanced (same URL):",
    `# ${postUrl}`
  );

  const out = envLines.join("\n") + "\n";
  writeFileSync("scripts/gumroad-env.generated.txt", out);
  console.log("\nWrote scripts/gumroad-env.generated.txt");
  console.log("Add those vars to Vercel, then redeploy.");
  console.log("\nPayout reminder:");
  console.log(
    "- If Gumroad country = Algeria → use a local Algerian bank (DZD), NOT Grey UK IBAN."
  );
  console.log(
    "- Grey GBP/EUR only fits if account country is UK/EU and KYC/residency passes."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
