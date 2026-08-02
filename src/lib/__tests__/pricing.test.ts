import { describe, expect, it } from "vitest";
import {
  annualListPrice,
  applyPercentOff,
  memberCreditDiscountPct,
  packBuyerSubPrice,
  quotePrice,
} from "@/lib/billing/pricing";

describe("pricing quotes", () => {
  it("gives ~2 months free on annual Pro", () => {
    expect(annualListPrice(17)).toBe(170);
    const q = quotePrice({ product: "subscription", interval: "annual" });
    expect(q.chargeUsd).toBe(170);
    expect(q.credits).toBe(2000 * 12);
  });

  it("applies pack-buyer discount stronger on Ultra than Pro", () => {
    expect(packBuyerSubPrice("subscription")).toBe(12);
    expect(packBuyerSubPrice("subscription_ultra")).toBe(79);
    const pro = quotePrice({
      product: "subscription",
      interval: "monthly",
      packBuyerDiscount: true,
    });
    const ultra = quotePrice({
      product: "subscription_ultra",
      interval: "monthly",
      packBuyerDiscount: true,
    });
    expect(pro.chargeUsd).toBe(12);
    expect(ultra.chargeUsd).toBe(79);
    expect(ultra.listUsd - ultra.chargeUsd).toBeGreaterThan(
      pro.listUsd - pro.chargeUsd
    );
  });

  it("gives Ultra members a better credit-pack discount than Pro", () => {
    expect(memberCreditDiscountPct("pro")).toBe(10);
    expect(memberCreditDiscountPct("ultra")).toBe(15);
    const asPro = quotePrice({
      product: "credits_medium",
      memberTier: "pro",
    });
    const asUltra = quotePrice({
      product: "credits_medium",
      memberTier: "ultra",
    });
    expect(asUltra.chargeUsd).toBeLessThan(asPro.chargeUsd);
    expect(applyPercentOff(29, 10)).toBe(26);
  });
});
