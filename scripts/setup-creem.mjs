/**
 * Provision Creem products for Memories Recap (test or live).
 * Requires CREEM_API_KEY. Uses test-api when key starts with creem_test_.
 */
import { writeFileSync } from "node:fs";

const apiKey = process.env.CREEM_API_KEY;
if (!apiKey) {
  console.error("Missing CREEM_API_KEY");
  process.exit(1);
}

const test = apiKey.startsWith("creem_test_") || process.env.CREEM_TEST_MODE === "true";
const base = test ? "https://test-api.creem.io/v1" : "https://api.creem.io/v1";

const CATALOG = [
  {
    key: "subscription",
    name: "Pro Monthly",
    description:
      "Monthly credits for Memories Recap. Cancel anytime. Access until period end.",
    price: 1700,
    billing_type: "recurring",
    billing_period: "every-month",
    credits: 2000,
  },
  {
    key: "credits_small",
    name: "Small Credit Pack",
    description: "500 credits for Memories Recap. Valid for 90 days.",
    price: 900,
    billing_type: "onetime",
    billing_period: "once",
    credits: 500,
  },
  {
    key: "credits_medium",
    name: "Medium Credit Pack",
    description: "2000 credits for Memories Recap. Valid for 90 days.",
    price: 2900,
    billing_type: "onetime",
    billing_period: "once",
    credits: 2000,
  },
  {
    key: "credits_large",
    name: "Large Credit Pack",
    description: "5000 credits for Memories Recap. Valid for 90 days.",
    price: 6900,
    billing_type: "onetime",
    billing_period: "once",
    credits: 5000,
  },
];

async function createProduct(item) {
  const body = {
    name: item.name,
    description: item.description,
    price: item.price,
    currency: "USD",
    billing_type: item.billing_type,
    tax_mode: "inclusive",
    tax_category: "saas",
  };
  // Live API rejects billing_period on some onetime creates; only send for recurring.
  if (item.billing_type === "recurring") {
    body.billing_period = item.billing_period;
  }

  const res = await fetch(`${base}/products`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": `memory-recap-${item.key}-v1`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

async function main() {
  console.log(`Creem mode: ${test ? "test" : "live"} (${base})`);
  const ids = {};
  for (const item of CATALOG) {
    const product = await createProduct(item);
    ids[item.key] = product.id;
    console.log(`${item.key}: ${product.id}`);
  }

  const env = {
    CREEM_API_KEY: apiKey,
    CREEM_TEST_MODE: String(test),
    CREEM_PRODUCT_SUBSCRIPTION: ids.subscription,
    CREEM_PRODUCT_CREDITS_SMALL: ids.credits_small,
    CREEM_PRODUCT_CREDITS_MEDIUM: ids.credits_medium,
    CREEM_PRODUCT_CREDITS_LARGE: ids.credits_large,
    CREEM_CREDITS_SUBSCRIPTION: "2000",
    CREEM_CREDITS_SMALL: "500",
    CREEM_CREDITS_MEDIUM: "2000",
    CREEM_CREDITS_LARGE: "5000",
  };
  writeFileSync(
    "/tmp/creem.env",
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
  console.log("Wrote /tmp/creem.env");
  console.log(
    "Add webhook in Creem dashboard → Developers → Webhooks:\n  https://memories-recap-one.vercel.app/api/webhooks/creem"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
