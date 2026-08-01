import type { ProductKey } from "@/lib/billing/types";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function numberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function isCreemTestMode() {
  if (process.env.CREEM_TEST_MODE === "false") return false;
  if (process.env.CREEM_TEST_MODE === "true") return true;
  return (process.env.CREEM_API_KEY || "").startsWith("creem_test_");
}

export function getCreemApiKey() {
  return required("CREEM_API_KEY");
}

export function getCreemWebhookSecret() {
  return required("CREEM_WEBHOOK_SECRET");
}

export function getAppUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Active merchant of record: whop | gumroad | creem */
export function getBillingProvider(): "whop" | "gumroad" | "creem" {
  const raw = (process.env.BILLING_PROVIDER || "").toLowerCase();
  if (raw === "whop" || raw === "gumroad" || raw === "creem") return raw;
  if (process.env.WHOP_API_KEY && process.env.WHOP_COMPANY_ID) {
    return "whop";
  }
  // Prefer Gumroad when token + at least one permalink are present
  if (
    process.env.GUMROAD_ACCESS_TOKEN &&
    (process.env.GUMROAD_PERMALINK_CREDITS_SMALL ||
      process.env.GUMROAD_PRODUCT_CREDITS_SMALL)
  ) {
    return "gumroad";
  }
  return "creem";
}

export const FREE_CREDITS = numberEnv("FREE_CREDITS", 200);
/** Daily login top-up when balance is low. */
export const DAILY_LOGIN_CREDITS = numberEnv("DAILY_LOGIN_CREDITS", 30);
export const DAILY_LOGIN_BALANCE_CAP = numberEnv("DAILY_LOGIN_BALANCE_CAP", 300);
export const CREDIT_EXPIRY_DAYS = numberEnv("CREDIT_EXPIRY_DAYS", 90);
export const MIN_JOB_CREDITS = numberEnv("MIN_JOB_CREDITS", 10);

export const PRODUCT_CREDITS: Record<ProductKey, number> = {
  subscription: numberEnv("CREEM_CREDITS_SUBSCRIPTION", 2000),
  subscription_ultra: numberEnv("CREEM_CREDITS_ULTRA", 8000),
  credits_small: numberEnv("CREEM_CREDITS_SMALL", 500),
  credits_medium: numberEnv("CREEM_CREDITS_MEDIUM", 2000),
  credits_large: numberEnv("CREEM_CREDITS_LARGE", 5000),
  credits_studio: numberEnv("CREEM_CREDITS_STUDIO", 50000),
};

/** Display prices in USD (mirrors Creem/Gumroad catalog). */
export const PRODUCT_USD: Record<ProductKey, number> = {
  subscription: 17,
  subscription_ultra: 97,
  credits_small: 9,
  credits_medium: 29,
  credits_large: 69,
  /** Anchor / enterprise display pack */
  credits_studio: 1497,
};

/** Pro monthly after credit-pack purchase (7-day window). Display only until checkout SKU exists. */
export const PRO_DISCOUNT_USD = 12;
export const PRO_DISCOUNT_WINDOW_DAYS = 7;

export function getProductId(key: ProductKey) {
  const map: Record<ProductKey, string> = {
    subscription: "CREEM_PRODUCT_SUBSCRIPTION",
    subscription_ultra: "CREEM_PRODUCT_SUBSCRIPTION_ULTRA",
    credits_small: "CREEM_PRODUCT_CREDITS_SMALL",
    credits_medium: "CREEM_PRODUCT_CREDITS_MEDIUM",
    credits_large: "CREEM_PRODUCT_CREDITS_LARGE",
    credits_studio: "CREEM_PRODUCT_CREDITS_STUDIO",
  };
  return required(map[key]);
}

export function productKeyFromId(productId: string): ProductKey | null {
  const entries: Array<[ProductKey, string | undefined]> = [
    ["subscription", process.env.CREEM_PRODUCT_SUBSCRIPTION],
    ["subscription_ultra", process.env.CREEM_PRODUCT_SUBSCRIPTION_ULTRA],
    ["credits_small", process.env.CREEM_PRODUCT_CREDITS_SMALL],
    ["credits_medium", process.env.CREEM_PRODUCT_CREDITS_MEDIUM],
    ["credits_large", process.env.CREEM_PRODUCT_CREDITS_LARGE],
    ["credits_studio", process.env.CREEM_PRODUCT_CREDITS_STUDIO],
  ];
  for (const [key, id] of entries) {
    if (id && id === productId) return key;
  }
  return null;
}

/** 1 credit ≈ 1 MB processed, with a minimum charge. */
export function creditsForBytes(totalBytes: number) {
  const mb = Math.ceil(totalBytes / (1024 * 1024));
  return Math.max(MIN_JOB_CREDITS, mb);
}
