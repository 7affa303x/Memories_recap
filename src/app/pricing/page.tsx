import Link from "next/link";
import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { PricingCheckout } from "@/components/pricing-checkout";
import { FREE_CREDITS } from "@/lib/billing/config";
import { getBillingSummary } from "@/lib/billing/credits";
import { getBillingProvider } from "@/lib/billing/config";
import { ULTRA_ENABLED } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Pricing · Memories Recap",
  description: "Subscriptions and credit packs for Memories Recap.",
};

export default async function PricingPage() {
  const user = await getOptionalUser();
  let packBuyerDiscount = false;
  let memberTier: "pro" | "ultra" | null = null;
  if (user?.email) {
    try {
      const summary = await getBillingSummary(user.id, user.email);
      packBuyerDiscount = Boolean(summary.proDiscountEligible);
      memberTier = summary.memberTier ?? null;
    } catch {
      packBuyerDiscount = false;
      memberTier = null;
    }
  }
  const provider = getBillingProvider();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader active="pricing" />

      <section className="mt-8 space-y-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Pricing</h1>
          <p className="mt-2 text-neutral-500">
            Two ways to pay: a plan, or credit packs.{" "}
            <span className="text-neutral-700">
              Free includes {FREE_CREDITS} credits on signup.
            </span>
          </p>
        </div>

        <PricingCheckout
          signedIn={Boolean(user)}
          packBuyerDiscount={packBuyerDiscount}
          memberTier={memberTier}
          showUltra={ULTRA_ENABLED}
        />

        <div className="space-y-2 text-sm text-neutral-500">
          <p>1 credit ≈ 1 MB processed (minimum 10 per job).</p>
          <p>If processing fails on our side, credits are restored.</p>
          <p>
            Checkout via {provider === "whop" ? "Whop" : provider}.{" "}
            <Link href="/support" className="text-green-700 underline">
              Support
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
