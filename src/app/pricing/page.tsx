import Link from "next/link";
import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { BuyButton } from "@/components/buy-button";
import { Button } from "@/components/ui/button";
import { ProfsBlock } from "@/components/profs-block";
import {
  FREE_CREDITS,
  PRODUCT_CREDITS,
  PRODUCT_USD,
  PRO_DISCOUNT_USD,
} from "@/lib/billing/config";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { getBillingSummary } from "@/lib/billing/credits";
import { ULTRA_ENABLED } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Pricing · Memories Recap",
  description: "Simple credit pricing for Memories Recap. Pay only for processed size.",
};

export default async function PricingPage() {
  const user = await getOptionalUser();
  let proDiscountEligible = false;
  if (user?.email) {
    try {
      const summary = await getBillingSummary(user.id, user.email);
      proDiscountEligible = Boolean(summary.proDiscountEligible);
    } catch {
      proDiscountEligible = false;
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader active="pricing" />

      <section className="mt-8 space-y-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Pricing</h1>
          <p className="mt-2 text-neutral-500">
            Clear prices. Pack credits expire after 90 days. Pro monthly credits
            last 365 days so unused balance can carry across months.
          </p>
        </div>

        <div className="overflow-x-auto rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-800">Free vs Pro vs Ultra</p>
          <table className="mt-4 w-full min-w-[300px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="pb-2 pr-3 font-medium">Feature</th>
                <th className="pb-2 pr-3 font-medium">Free</th>
                <th className="pb-2 pr-3 font-medium">Pro</th>
                <th className="pb-2 font-medium">Ultra</th>
              </tr>
            </thead>
            <tbody className="text-neutral-700">
              <tr className="border-b border-neutral-100">
                <td className="py-2.5 pr-3">Watermark</td>
                <td className="py-2.5 pr-3">Light overlay</td>
                <td className="py-2.5 pr-3">None</td>
                <td className="py-2.5">None</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5 pr-3">Output</td>
                <td className="py-2.5 pr-3">Full HD</td>
                <td className="py-2.5 pr-3">Up to 4K</td>
                <td className="py-2.5">Up to 4K + priority</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5 pr-3">Large files</td>
                <td className="py-2.5 pr-3">Auto limits</td>
                <td className="py-2.5 pr-3">Higher limits</td>
                <td className="py-2.5">Manual review lane</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3">Support</td>
                <td className="py-2.5 pr-3">Standard</td>
                <td className="py-2.5 pr-3">Priority email</td>
                <td className="py-2.5">White-glove check</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Free</p>
          <p className="mt-2 text-3xl font-medium">{FREE_CREDITS} credits</p>
          <p className="mt-2 text-sm text-neutral-500">
            On signup · site music library · light watermark · brand end card
          </p>
        </div>

        <div className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <div>
            <p className="text-sm text-neutral-500">Pro Monthly</p>
            {proDiscountEligible ? (
              <p className="mt-2 text-3xl font-medium">
                <span className="mr-2 text-neutral-400 line-through">
                  ${PRODUCT_USD.subscription}
                </span>
                ${PRO_DISCOUNT_USD}
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-sm font-medium text-green-900">
                  Pack buyer deal · 7 days
                </span>
              </p>
            ) : (
              <p className="mt-2 text-3xl font-medium">${PRODUCT_USD.subscription}</p>
            )}
            <p className="mt-1 text-sm text-neutral-500">
              {PRODUCT_CREDITS.subscription} credits / month · stronger AI · 4K
              · highlights · 90-day archive · cancel anytime
            </p>
            {proDiscountEligible ? (
              <p className="mt-2 text-xs text-green-800">
                You bought credits recently — claim Pro at ${PRO_DISCOUNT_USD}/mo
                via support while we finish the discounted checkout SKU.
              </p>
            ) : null}
          </div>
          {user ? (
            proDiscountEligible ? (
              <Button asChild className="h-12 w-full rounded-[16px]">
                <a href="mailto:haffa303@gmail.com?subject=Pro%20discount%20after%20credits">
                  Claim Pro discount
                </a>
              </Button>
            ) : (
              <BuyButton product="subscription" label="Subscribe monthly" />
            )
          ) : (
            <GoogleSignInButton
              callbackUrl="/pricing"
              label="Sign in to subscribe"
            />
          )}
        </div>

        {ULTRA_ENABLED ? (
          <div className="space-y-4 rounded-[16px] border border-green-200 bg-green-50/60 p-5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-green-900">Ultra</p>
              <p className="mt-2 text-3xl font-medium text-green-950">
                ${PRODUCT_USD.subscription_ultra}
                <span className="text-base font-normal text-neutral-500"> / mo</span>
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {PRODUCT_CREDITS.subscription_ultra} credits · everything in Pro ·
                priority queue · <strong>manual verification for oversized files</strong> ·
                white-glove recovery when a heavy batch needs a human eye.
              </p>
            </div>
            <Button asChild className="h-12 w-full rounded-[16px] bg-green-900 hover:bg-green-800">
              <a href="mailto:haffa303@gmail.com?subject=Memories%20Recap%20Ultra">
                Request Ultra access
              </a>
            </Button>
          </div>
        ) : null}

        <div className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <div>
            <p className="text-sm text-neutral-500">Pro Annual</p>
            <p className="mt-2 text-3xl font-medium">$170</p>
            <p className="mt-1 text-sm text-neutral-500">
              Same Pro benefits · ~2 months free vs monthly.
            </p>
          </div>
          <Button asChild variant="secondary" className="h-12 w-full rounded-[16px]">
            <a href="mailto:haffa303@gmail.com?subject=Memories%20Recap%20annual%20Pro">
              Request annual Pro
            </a>
          </Button>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-medium">Credit packs</h2>
          <p className="text-sm text-neutral-500">
            Buy credits anytime. Packs remove the overlay watermark. Buying a pack
            unlocks a limited Pro discount for 7 days.
          </p>
          {(
            [
              ["credits_small", "Small", PRODUCT_CREDITS.credits_small, PRODUCT_USD.credits_small],
              ["credits_medium", "Medium", PRODUCT_CREDITS.credits_medium, PRODUCT_USD.credits_medium],
              ["credits_large", "Large", PRODUCT_CREDITS.credits_large, PRODUCT_USD.credits_large],
            ] as const
          ).map(([product, name, credits, usd]) => (
            <div
              key={product}
              className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm"
            >
              <div>
                <p className="text-sm text-neutral-500">{name} pack</p>
                <p className="mt-2 text-2xl font-medium">${usd}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {credits} credits · one-time · 90 days
                </p>
              </div>
              {user ? (
                <BuyButton product={product} label={`Buy ${name.toLowerCase()}`} />
              ) : (
                <GoogleSignInButton
                  callbackUrl="/pricing"
                  label="Sign in to buy"
                />
              )}
            </div>
          ))}

          <div className="space-y-4 rounded-[16px] bg-neutral-900 p-5 text-white shadow-sm">
            <div>
              <p className="text-sm text-neutral-300">Studio / Enterprise anchor</p>
              <p className="mt-2 text-3xl font-medium">${PRODUCT_USD.credits_studio}</p>
              <p className="mt-1 text-sm text-neutral-400">
                {PRODUCT_CREDITS.credits_studio.toLocaleString()} credits · teams,
                agencies, and heavy archives. Makes every other pack feel light —
                and it’s a real lane when you need volume + Ultra review.
              </p>
            </div>
            <Button asChild variant="secondary" className="h-12 w-full rounded-[16px]">
              <a href="mailto:haffa303@gmail.com?subject=Memories%20Recap%20Studio%20%241497">
                Talk about Studio
              </a>
            </Button>
          </div>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 text-sm text-neutral-600 shadow-sm">
          <p className="font-medium text-neutral-800">Music on Memories Recap</p>
          <p className="mt-2">
            We ship a site music library (including trendy, affordable NCS-style
            tracks) so recaps stay safe to share. Paid/extra catalogs stay behind
            a flag until fully wired.
          </p>
        </div>

        <ProfsBlock />

        <div className="space-y-3 text-sm text-neutral-500">
          <p className="font-medium text-neutral-800">FAQ</p>
          <p>1 credit ≈ 1 MB processed (minimum 10 per job).</p>
          <p>If processing fails on our side, credits are restored.</p>
          <p>
            Need a hand?{" "}
            <Link href="/support" className="text-green-700 underline">
              Human support
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
