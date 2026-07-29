import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveGumroadSaleProduct } from "@/lib/billing/gumroad";
import { watermarkExemptAfterGrant } from "@/lib/billing/credits";
import { sharePasswordFromRequest } from "@/lib/share-password";
import { isBillingSelfPurchase } from "@/lib/billing/self-purchase";

describe("resolveGumroadSaleProduct", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.GUMROAD_PRODUCT_CREDITS_SMALL = "prod_small";
    process.env.GUMROAD_PERMALINK_CREDITS_SMALL = "memories-recap-credits-500";
    process.env.GUMROAD_PRODUCT_CREDITS_MEDIUM = "prod_medium";
    process.env.GUMROAD_PERMALINK_CREDITS_MEDIUM = "memories-recap-credits-2000";
    process.env.GUMROAD_PRODUCT_CREDITS_LARGE = "prod_large";
    process.env.GUMROAD_PERMALINK_CREDITS_LARGE = "memories-recap-credits-5000";
    process.env.GUMROAD_PRODUCT_SUBSCRIPTION = "prod_sub";
    process.env.GUMROAD_PERMALINK_SUBSCRIPTION = "memories-recap-pro-monthly";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("maps from product id and ignores mismatched url_params.product", () => {
    const resolved = resolveGumroadSaleProduct({
      productId: "prod_medium",
      permalink: null,
      productName: null,
      urlParamsProduct: "credits_small",
    });
    expect(resolved.key).toBe("credits_medium");
    expect(resolved.mismatched).toBe(true);
    expect(resolved.ignoredUrlParamsProduct).toBe("credits_small");
  });

  it("maps from permalink when product id missing", () => {
    const resolved = resolveGumroadSaleProduct({
      productId: null,
      permalink: "memories-recap-credits-5000",
      productName: null,
      urlParamsProduct: "subscription",
    });
    expect(resolved.key).toBe("credits_large");
    expect(resolved.mismatched).toBe(true);
  });

  it("does not treat matching url_params as the source of truth (no mismatch)", () => {
    const resolved = resolveGumroadSaleProduct({
      productId: "prod_small",
      permalink: null,
      productName: null,
      urlParamsProduct: "credits_small",
    });
    expect(resolved.key).toBe("credits_small");
    expect(resolved.mismatched).toBe(false);
  });
});

describe("sharePasswordFromRequest", () => {
  it("never accepts password via GET query", () => {
    expect(
      sharePasswordFromRequest({
        method: "GET",
        queryPassword: "secret",
        bodyPassword: null,
      })
    ).toBeNull();
  });

  it("accepts password from POST body", () => {
    expect(
      sharePasswordFromRequest({
        method: "POST",
        queryPassword: "ignored",
        bodyPassword: " family ",
      })
    ).toBe("family");
  });
});

describe("watermarkExemptAfterGrant", () => {
  it("sets exempt on pack purchase", () => {
    expect(watermarkExemptAfterGrant(false, "pack")).toBe(true);
    expect(watermarkExemptAfterGrant(true, "pack")).toBe(true);
  });

  it("does not set exempt on free or subscription alone", () => {
    expect(watermarkExemptAfterGrant(false, "free")).toBe(false);
    expect(watermarkExemptAfterGrant(false, "subscription")).toBe(false);
    expect(watermarkExemptAfterGrant(true, "subscription")).toBe(true);
  });
});

describe("isBillingSelfPurchase", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("matches denylist and seller email", () => {
    process.env.BILLING_SELF_TEST_EMAILS = "a@test.com, b@test.com";
    process.env.GUMROAD_SELLER_EMAIL = "seller@gumroad.com";
    expect(isBillingSelfPurchase("a@test.com")).toBe(true);
    expect(isBillingSelfPurchase("B@TEST.COM")).toBe(true);
    expect(isBillingSelfPurchase("seller@gumroad.com")).toBe(true);
    expect(isBillingSelfPurchase("buyer@example.com")).toBe(false);
  });
});
