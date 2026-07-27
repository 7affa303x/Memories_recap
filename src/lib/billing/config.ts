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

export function getPolarServer(): "sandbox" | "production" {
  return process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production";
}

export function getPolarAccessToken() {
  return required("POLAR_ACCESS_TOKEN");
}

export function getPolarWebhookSecret() {
  return required("POLAR_WEBHOOK_SECRET");
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
  subscription: numberEnv("POLAR_CREDITS_SUBSCRIPTION", 2000),
  credits_small: numberEnv("POLAR_CREDITS_SMALL", 500),
  credits_medium: numberEnv("POLAR_CREDITS_MEDIUM", 2000),
  credits_large: numberEnv("POLAR_CREDITS_LARGE", 5000),
};

export function getProductId(key: ProductKey) {
  const map: Record<ProductKey, string> = {
    subscription: "POLAR_PRODUCT_SUBSCRIPTION",
    credits_small: "POLAR_PRODUCT_CREDITS_SMALL",
    credits_medium: "POLAR_PRODUCT_CREDITS_MEDIUM",
    credits_large: "POLAR_PRODUCT_CREDITS_LARGE",
  };
  return required(map[key]);
}

export function productKeyFromId(productId: string): ProductKey | null {
  const entries: Array<[ProductKey, string | undefined]> = [
    ["subscription", process.env.POLAR_PRODUCT_SUBSCRIPTION],
    ["credits_small", process.env.POLAR_PRODUCT_CREDITS_SMALL],
    ["credits_medium", process.env.POLAR_PRODUCT_CREDITS_MEDIUM],
    ["credits_large", process.env.POLAR_PRODUCT_CREDITS_LARGE],
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
