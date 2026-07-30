import type { ProductKey } from "@/lib/billing/types";
import {
  getAppUrl,
  PRODUCT_CREDITS,
  PRODUCT_USD,
} from "@/lib/billing/config";

const API = "https://api.gumroad.com/v2";

export type GumroadProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  published: boolean;
  short_url?: string | null;
  url?: string | null;
  custom_permalink?: string | null;
  subscription_duration?: string | null;
  native_type?: string | null;
};

function accessToken() {
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) throw new Error("Missing GUMROAD_ACCESS_TOKEN");
  return token;
}

export function hasGumroadToken() {
  return Boolean(process.env.GUMROAD_ACCESS_TOKEN);
}

async function gumroadForm(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  fields: Record<string, string | number | boolean | undefined> = {}
) {
  const token = accessToken();
  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    body.set(key, String(value));
  }

  const url =
    method === "GET"
      ? `${API}${path}?${body.toString()}`
      : `${API}${path}`;

  const res = await fetch(url, {
    method,
    headers:
      method === "GET"
        ? undefined
        : { "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body.toString(),
  });

  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    product?: GumroadProduct;
    products?: GumroadProduct[];
    resource_subscription?: { id: string; resource_name: string; post_url: string };
    resource_subscriptions?: Array<{ id: string; resource_name: string; post_url: string }>;
  };

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Gumroad ${method} ${path} failed (${res.status})`);
  }
  return json;
}

export async function listGumroadProducts() {
  const json = await gumroadForm("GET", "/products");
  return json.products || [];
}

export async function createGumroadProduct(input: {
  name: string;
  description: string;
  priceCents: number;
  customPermalink: string;
  nativeType?: "digital" | "membership";
  subscriptionDuration?: "monthly" | "yearly";
}) {
  return gumroadForm("POST", "/products", {
    name: input.name,
    description: input.description,
    price: input.priceCents,
    price_currency_type: "usd",
    custom_permalink: input.customPermalink,
    native_type: input.nativeType || "digital",
    subscription_duration: input.subscriptionDuration,
    refund_period: "14",
    custom_summary: "Credits deliver instantly to your Memories Recap account after payment.",
  });
}

export async function enableGumroadProduct(productId: string) {
  return gumroadForm("PUT", `/products/${productId}/enable`);
}

export async function ensureResourceSubscription(
  resourceName:
    | "sale"
    | "refund"
    | "cancellation"
    | "subscription_updated"
    | "subscription_ended"
    | "subscription_restarted",
  postUrl: string
) {
  return gumroadForm("PUT", "/resource_subscriptions", {
    resource_name: resourceName,
    post_url: postUrl,
  });
}

/** Map product key → Gumroad product id / permalink from env. */
export function getGumroadProductRef(key: ProductKey): {
  id?: string;
  permalink?: string;
} {
  const map: Record<ProductKey, { id?: string; permalink?: string }> = {
    subscription: {
      id: process.env.GUMROAD_PRODUCT_SUBSCRIPTION,
      permalink: process.env.GUMROAD_PERMALINK_SUBSCRIPTION,
    },
    subscription_ultra: {
      id: process.env.GUMROAD_PRODUCT_SUBSCRIPTION_ULTRA,
      permalink: process.env.GUMROAD_PERMALINK_SUBSCRIPTION_ULTRA,
    },
    credits_small: {
      id: process.env.GUMROAD_PRODUCT_CREDITS_SMALL,
      permalink: process.env.GUMROAD_PERMALINK_CREDITS_SMALL,
    },
    credits_medium: {
      id: process.env.GUMROAD_PRODUCT_CREDITS_MEDIUM,
      permalink: process.env.GUMROAD_PERMALINK_CREDITS_MEDIUM,
    },
    credits_large: {
      id: process.env.GUMROAD_PRODUCT_CREDITS_LARGE,
      permalink: process.env.GUMROAD_PERMALINK_CREDITS_LARGE,
    },
    credits_studio: {
      id: process.env.GUMROAD_PRODUCT_CREDITS_STUDIO,
      permalink: process.env.GUMROAD_PERMALINK_CREDITS_STUDIO,
    },
  };
  return map[key];
}

export function productKeyFromGumroad(input: {
  productId?: string | null;
  permalink?: string | null;
  productName?: string | null;
}): ProductKey | null {
  const entries: Array<[ProductKey, { id?: string; permalink?: string }]> = [
    ["subscription", getGumroadProductRef("subscription")],
    ["subscription_ultra", getGumroadProductRef("subscription_ultra")],
    ["credits_small", getGumroadProductRef("credits_small")],
    ["credits_medium", getGumroadProductRef("credits_medium")],
    ["credits_large", getGumroadProductRef("credits_large")],
    ["credits_studio", getGumroadProductRef("credits_studio")],
  ];
  for (const [key, ref] of entries) {
    if (input.productId && ref.id && input.productId === ref.id) return key;
    if (
      input.permalink &&
      ref.permalink &&
      input.permalink.replace(/^\/+|\/+$/g, "") ===
        ref.permalink.replace(/^\/+|\/+$/g, "")
    ) {
      return key;
    }
  }
  // Fallback by credits amount mentioned in name
  const name = (input.productName || "").toLowerCase();
  if (name.includes("pro monthly") || name.includes("subscription")) {
    return "subscription";
  }
  if (name.includes("5000") || name.includes("large")) return "credits_large";
  if (name.includes("2000") || name.includes("medium")) return "credits_medium";
  if (name.includes("500") || name.includes("small")) return "credits_small";
  return null;
}

/**
 * Resolve grant product from Gumroad product id/permalink/name only.
 * Never trusts url_params.product — mismatches are ignored (logged by caller).
 */
export function resolveGumroadSaleProduct(input: {
  productId?: string | null;
  permalink?: string | null;
  productName?: string | null;
  /** Ignored for granting; returned only so callers can log mismatches. */
  urlParamsProduct?: string | null;
}): {
  key: ProductKey | null;
  ignoredUrlParamsProduct: string | null;
  mismatched: boolean;
} {
  const key = productKeyFromGumroad({
    productId: input.productId,
    permalink: input.permalink,
    productName: input.productName,
  });
  const claimed = input.urlParamsProduct || null;
  const mismatched = Boolean(claimed && key && claimed !== key);
  return {
    key,
    ignoredUrlParamsProduct: claimed,
    mismatched,
  };
}

/**
 * Checkout URL with url_params so the sale webhook can map back to our user.
 */
export function buildGumroadCheckoutUrl(input: {
  product: ProductKey;
  userId: string;
  email: string;
}) {
  const ref = getGumroadProductRef(input.product);
  const permalink = ref.permalink;
  if (!permalink) {
    throw new Error(
      `Gumroad product not configured for ${input.product}. Run setup-gumroad or set GUMROAD_PERMALINK_*`
    );
  }

  const base = permalink.startsWith("http")
    ? permalink
    : `https://gumroad.com/l/${permalink.replace(/^\/+/, "")}`;

  const url = new URL(base);
  url.searchParams.set("wanted", "true");
  url.searchParams.set("user_id", input.userId);
  url.searchParams.set("email", input.email);
  url.searchParams.set("product", input.product);
  url.searchParams.set("credits", String(PRODUCT_CREDITS[input.product]));
  url.searchParams.set("usd", String(PRODUCT_USD[input.product]));
  url.searchParams.set("return_url", `${getAppUrl()}/billing?checkout=success`);
  return url.toString();
}

export function gumroadWebhookUrl() {
  const secret = process.env.GUMROAD_WEBHOOK_SECRET;
  const base = `${getAppUrl()}/api/webhooks/gumroad`;
  if (!secret) return base;
  return `${base}?token=${encodeURIComponent(secret)}`;
}

export const GUMROAD_CATALOG: Array<{
  key: ProductKey;
  name: string;
  description: string;
  priceCents: number;
  permalink: string;
  nativeType: "digital" | "membership";
  subscriptionDuration?: "monthly";
}> = [
  {
    key: "subscription",
    name: "Memories Recap Pro Monthly",
    description:
      "<p>Pro monthly for Memories Recap: stronger AI, 4K, highlights, 90-day archive, no overlay watermark. Credits grant after payment.</p>",
    priceCents: PRODUCT_USD.subscription * 100,
    permalink: "memories-recap-pro-monthly",
    nativeType: "membership",
    subscriptionDuration: "monthly",
  },
  {
    key: "credits_small",
    name: "Memories Recap · 500 credits",
    description:
      "<p>500 processing credits for Memories Recap (about 500 MB). Valid 90 days.</p>",
    priceCents: PRODUCT_USD.credits_small * 100,
    permalink: "memories-recap-credits-500",
    nativeType: "digital",
  },
  {
    key: "credits_medium",
    name: "Memories Recap · 2000 credits",
    description:
      "<p>2000 processing credits for Memories Recap. Valid 90 days.</p>",
    priceCents: PRODUCT_USD.credits_medium * 100,
    permalink: "memories-recap-credits-2000",
    nativeType: "digital",
  },
  {
    key: "credits_large",
    name: "Memories Recap · 5000 credits",
    description:
      "<p>5000 processing credits for Memories Recap. Valid 90 days.</p>",
    priceCents: PRODUCT_USD.credits_large * 100,
    permalink: "memories-recap-credits-5000",
    nativeType: "digital",
  },
];
