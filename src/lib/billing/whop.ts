import { Whop } from "@whop/sdk";
import {
  getAppUrl,
  PRODUCT_CREDITS,
} from "@/lib/billing/config";
import {
  isSubscriptionProduct,
  quotePrice,
  type BillingInterval,
} from "@/lib/billing/pricing";
import type { ProductKey } from "@/lib/billing/types";

let client: Whop | null = null;

export function getWhopApiKey() {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new Error("Missing WHOP_API_KEY");
  return key;
}

export function getWhopCompanyId() {
  const id = process.env.WHOP_COMPANY_ID;
  if (!id) throw new Error("Missing WHOP_COMPANY_ID (biz_… from Whop dashboard)");
  return id;
}

export function getWhopClient() {
  if (client) return client;
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
  client = new Whop({
    apiKey: getWhopApiKey(),
    ...(webhookSecret
      ? { webhookKey: Buffer.from(webhookSecret).toString("base64") }
      : {}),
  });
  return client;
}

function envProductId(product: ProductKey): string | undefined {
  const map: Record<ProductKey, string | undefined> = {
    subscription: process.env.WHOP_PRODUCT_SUBSCRIPTION,
    subscription_ultra: process.env.WHOP_PRODUCT_SUBSCRIPTION_ULTRA,
    credits_small: process.env.WHOP_PRODUCT_CREDITS_SMALL,
    credits_medium: process.env.WHOP_PRODUCT_CREDITS_MEDIUM,
    credits_large: process.env.WHOP_PRODUCT_CREDITS_LARGE,
    credits_studio: process.env.WHOP_PRODUCT_CREDITS_STUDIO,
  };
  return map[product] || undefined;
}

function envPlanId(
  product: ProductKey,
  interval: BillingInterval,
  discounted: boolean
): string | undefined {
  const ultra = product === "subscription_ultra";
  if (product === "subscription" || ultra) {
    if (interval === "annual") {
      return ultra
        ? process.env.WHOP_PLAN_ULTRA_ANNUAL
        : process.env.WHOP_PLAN_PRO_ANNUAL;
    }
    if (discounted) {
      return ultra
        ? process.env.WHOP_PLAN_ULTRA_MONTHLY_DISCOUNTED
        : process.env.WHOP_PLAN_PRO_MONTHLY_DISCOUNTED;
    }
    return ultra
      ? process.env.WHOP_PLAN_ULTRA_MONTHLY
      : process.env.WHOP_PLAN_PRO_MONTHLY;
  }
  const packMap: Partial<Record<ProductKey, string | undefined>> = {
    credits_small: discounted
      ? process.env.WHOP_PLAN_CREDITS_SMALL_MEMBER ||
        process.env.WHOP_PLAN_CREDITS_SMALL
      : process.env.WHOP_PLAN_CREDITS_SMALL,
    credits_medium: discounted
      ? process.env.WHOP_PLAN_CREDITS_MEDIUM_MEMBER ||
        process.env.WHOP_PLAN_CREDITS_MEDIUM
      : process.env.WHOP_PLAN_CREDITS_MEDIUM,
    credits_large: discounted
      ? process.env.WHOP_PLAN_CREDITS_LARGE_MEMBER ||
        process.env.WHOP_PLAN_CREDITS_LARGE
      : process.env.WHOP_PLAN_CREDITS_LARGE,
    credits_studio: process.env.WHOP_PLAN_CREDITS_STUDIO,
  };
  return packMap[product];
}

export function productKeyFromWhopIds(input: {
  productId?: string | null;
  planId?: string | null;
  metadataProduct?: string | null;
}): ProductKey | null {
  if (
    input.metadataProduct &&
    [
      "subscription",
      "subscription_ultra",
      "credits_small",
      "credits_medium",
      "credits_large",
      "credits_studio",
    ].includes(input.metadataProduct)
  ) {
    return input.metadataProduct as ProductKey;
  }
  const entries: Array<[ProductKey, string | undefined]> = [
    ["subscription", process.env.WHOP_PRODUCT_SUBSCRIPTION],
    ["subscription_ultra", process.env.WHOP_PRODUCT_SUBSCRIPTION_ULTRA],
    ["credits_small", process.env.WHOP_PRODUCT_CREDITS_SMALL],
    ["credits_medium", process.env.WHOP_PRODUCT_CREDITS_MEDIUM],
    ["credits_large", process.env.WHOP_PRODUCT_CREDITS_LARGE],
    ["credits_studio", process.env.WHOP_PRODUCT_CREDITS_STUDIO],
  ];
  for (const [key, id] of entries) {
    if (input.productId && id && input.productId === id) return key;
  }
  return null;
}

export async function createWhopCheckoutUrl(input: {
  product: ProductKey;
  userId: string;
  email: string;
  interval?: BillingInterval;
  packBuyerDiscount?: boolean;
  memberTier?: "pro" | "ultra" | null;
}) {
  const interval = input.interval ?? "monthly";
  const quote = quotePrice({
    product: input.product,
    interval,
    packBuyerDiscount: input.packBuyerDiscount,
    memberTier: input.memberTier,
  });
  const discounted = quote.chargeUsd < quote.listUsd;
  const whop = getWhopClient();
  const companyId = getWhopCompanyId();
  const appUrl = getAppUrl();
  const credits = quote.credits;
  const metadata = {
    userId: input.userId,
    email: input.email,
    product: input.product,
    interval,
    credits: String(credits),
    chargeUsd: String(quote.chargeUsd),
    listUsd: String(quote.listUsd),
  };

  const fixedPlanId = envPlanId(input.product, interval, discounted);
  if (fixedPlanId) {
    const session = await whop.checkoutConfigurations.create({
      account_id: companyId,
      plan_id: fixedPlanId,
      redirect_url: `${appUrl}/billing?checkout=success`,
      metadata,
    });
    if (!session.purchase_url) {
      throw new Error("Whop checkout missing purchase_url");
    }
    return { url: session.purchase_url, id: session.id, quote };
  }

  const productId = envProductId(input.product);
  if (!productId) {
    throw new Error(
      `Whop product not configured for ${input.product}. Set WHOP_PRODUCT_* or WHOP_PLAN_* in env.`
    );
  }

  const sub = isSubscriptionProduct(input.product);
  const session = await whop.checkoutConfigurations.create({
    account_id: companyId,
    redirect_url: `${appUrl}/billing?checkout=success`,
    metadata,
    plan: {
      product_id: productId,
      currency: "usd",
      plan_type: sub ? "renewal" : "one_time",
      billing_period: sub ? (interval === "annual" ? 365 : 30) : undefined,
      initial_price: quote.chargeUsd,
      renewal_price: sub ? quote.chargeUsd : undefined,
      title:
        input.product === "subscription_ultra"
          ? interval === "annual"
            ? "Memories Recap Ultra (Annual)"
            : "Memories Recap Ultra"
          : input.product === "subscription"
            ? interval === "annual"
              ? "Memories Recap Pro (Annual)"
              : "Memories Recap Pro"
            : `Memories Recap · ${PRODUCT_CREDITS[input.product]} credits`,
      metadata: {
        product: input.product,
        interval,
        credits: String(credits),
      },
    },
  });

  if (!session.purchase_url) {
    throw new Error("Whop checkout missing purchase_url");
  }
  return { url: session.purchase_url, id: session.id, quote };
}
