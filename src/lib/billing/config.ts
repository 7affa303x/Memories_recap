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

export function getPaddleEnvironment(): "sandbox" | "production" {
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV || process.env.PADDLE_ENV;
  return env === "sandbox" ? "sandbox" : "production";
}

export function getPaddleApiKey() {
  return required("PADDLE_API_KEY");
}

export function getPaddleWebhookSecret() {
  return required("PADDLE_NOTIFICATION_WEBHOOK_SECRET");
}

export function getPaddleClientToken() {
  return required("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
}

export function getAppUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export const FREE_CREDITS = numberEnv("FREE_CREDITS", 200);
export const CREDIT_EXPIRY_DAYS = numberEnv("CREDIT_EXPIRY_DAYS", 90);
export const MIN_JOB_CREDITS = numberEnv("MIN_JOB_CREDITS", 10);

export const PRODUCT_CREDITS: Record<ProductKey, number> = {
  subscription: numberEnv("PADDLE_CREDITS_SUBSCRIPTION", 2000),
  credits_small: numberEnv("PADDLE_CREDITS_SMALL", 500),
  credits_medium: numberEnv("PADDLE_CREDITS_MEDIUM", 2000),
  credits_large: numberEnv("PADDLE_CREDITS_LARGE", 5000),
};

/** Catalog USD amounts (cents) mirrored from the tested Polar catalog. */
export const PRODUCT_USD_CENTS: Record<ProductKey, number> = {
  subscription: 1700,
  credits_small: 900,
  credits_medium: 2900,
  credits_large: 6900,
};

export function getPriceId(key: ProductKey) {
  const map: Record<ProductKey, string> = {
    subscription: "PADDLE_PRICE_SUBSCRIPTION",
    credits_small: "PADDLE_PRICE_CREDITS_SMALL",
    credits_medium: "PADDLE_PRICE_CREDITS_MEDIUM",
    credits_large: "PADDLE_PRICE_CREDITS_LARGE",
  };
  return required(map[key]);
}

export function productKeyFromPriceId(priceId: string): ProductKey | null {
  const entries: Array<[ProductKey, string | undefined]> = [
    ["subscription", process.env.PADDLE_PRICE_SUBSCRIPTION],
    ["credits_small", process.env.PADDLE_PRICE_CREDITS_SMALL],
    ["credits_medium", process.env.PADDLE_PRICE_CREDITS_MEDIUM],
    ["credits_large", process.env.PADDLE_PRICE_CREDITS_LARGE],
  ];
  for (const [key, id] of entries) {
    if (id && id === priceId) return key;
  }
  return null;
}

/** 1 credit ≈ 1 MB processed, with a minimum charge. */
export function creditsForBytes(totalBytes: number) {
  const mb = Math.ceil(totalBytes / (1024 * 1024));
  return Math.max(MIN_JOB_CREDITS, mb);
}
