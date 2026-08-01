import {
  PRODUCT_CREDITS,
  PRODUCT_USD,
  PRO_DISCOUNT_USD,
  PRO_DISCOUNT_WINDOW_DAYS,
} from "@/lib/billing/config";
import type { ProductKey } from "@/lib/billing/types";

export type BillingInterval = "monthly" | "annual";

/** ~2 months free on annual (pay for 10). */
export const ANNUAL_MONTHS_CHARGED = 10;

/** Active Pro members get this off credit packs. */
export const PRO_MEMBER_CREDIT_DISCOUNT_PCT = 10;

/** Active Ultra members get a slightly better pack discount. */
export const ULTRA_MEMBER_CREDIT_DISCOUNT_PCT = 15;

/** Pack buyers (7-day window) get Ultra monthly at this USD price. */
export const ULTRA_DISCOUNT_USD = 79;

export const SUBSCRIPTION_PRODUCTS = [
  "subscription",
  "subscription_ultra",
] as const satisfies readonly ProductKey[];

export const CREDIT_PACK_PRODUCTS = [
  "credits_small",
  "credits_medium",
  "credits_large",
] as const satisfies readonly ProductKey[];

export function isSubscriptionProduct(product: ProductKey) {
  return (
    product === "subscription" || product === "subscription_ultra"
  );
}

export function annualListPrice(monthlyUsd: number) {
  return Math.round(monthlyUsd * ANNUAL_MONTHS_CHARGED);
}

export function annualSavingsUsd(monthlyUsd: number) {
  return Math.round(monthlyUsd * 12 - annualListPrice(monthlyUsd));
}

export function packBuyerSubPrice(product: "subscription" | "subscription_ultra") {
  return product === "subscription_ultra" ? ULTRA_DISCOUNT_USD : PRO_DISCOUNT_USD;
}

export function memberCreditDiscountPct(tier: "pro" | "ultra" | null) {
  if (tier === "ultra") return ULTRA_MEMBER_CREDIT_DISCOUNT_PCT;
  if (tier === "pro") return PRO_MEMBER_CREDIT_DISCOUNT_PCT;
  return 0;
}

export function applyPercentOff(usd: number, pct: number) {
  if (pct <= 0) return usd;
  return Math.max(1, Math.round(usd * (1 - pct / 100)));
}

export type PriceQuote = {
  product: ProductKey;
  interval: BillingInterval;
  listUsd: number;
  chargeUsd: number;
  credits: number;
  discountLabel: string | null;
  discountPct: number;
};

/**
 * Resolve what the buyer should pay for a SKU given loyalty discounts.
 */
export function quotePrice(input: {
  product: ProductKey;
  interval?: BillingInterval;
  /** Recent credit-pack purchase within PRO_DISCOUNT_WINDOW_DAYS */
  packBuyerDiscount?: boolean;
  /** Active subscription tier for pack discounts */
  memberTier?: "pro" | "ultra" | null;
}): PriceQuote {
  const interval = input.interval ?? "monthly";
  const product = input.product;
  const credits = PRODUCT_CREDITS[product];

  if (isSubscriptionProduct(product)) {
    const monthly = PRODUCT_USD[product];
    const listUsd =
      interval === "annual" ? annualListPrice(monthly) : monthly;
    let chargeUsd = listUsd;
    let discountLabel: string | null = null;
    let discountPct = 0;

    if (interval === "annual") {
      discountLabel = `Save $${annualSavingsUsd(monthly)} / yr`;
      discountPct = Math.round(
        (annualSavingsUsd(monthly) / (monthly * 12)) * 100
      );
    } else if (input.packBuyerDiscount) {
      chargeUsd = packBuyerSubPrice(
        product as "subscription" | "subscription_ultra"
      );
      discountLabel =
        product === "subscription_ultra"
          ? `Pack buyer · $${ULTRA_DISCOUNT_USD}/mo`
          : `Pack buyer · $${PRO_DISCOUNT_USD}/mo · ${PRO_DISCOUNT_WINDOW_DAYS}d`;
      discountPct = Math.round(((monthly - chargeUsd) / monthly) * 100);
    }

    return {
      product,
      interval,
      listUsd,
      chargeUsd,
      credits:
        interval === "annual"
          ? PRODUCT_CREDITS[product] * 12
          : PRODUCT_CREDITS[product],
      discountLabel,
      discountPct,
    };
  }

  // Credit packs
  const listUsd = PRODUCT_USD[product];
  const pct = memberCreditDiscountPct(input.memberTier ?? null);
  const chargeUsd = applyPercentOff(listUsd, pct);
  return {
    product,
    interval: "monthly",
    listUsd,
    chargeUsd,
    credits,
    discountLabel:
      pct > 0
        ? `${input.memberTier === "ultra" ? "Ultra" : "Pro"} member −${pct}%`
        : null,
    discountPct: pct,
  };
}
