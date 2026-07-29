import Link from "next/link";
import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { BuyButton } from "@/components/buy-button";
import { Button } from "@/components/ui/button";
import {
  FREE_CREDITS,
  PRODUCT_CREDITS,
  PRODUCT_USD,
} from "@/lib/billing/config";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata: Metadata = {
  title: "Pricing · Memories Recap",
  description: "Simple credit pricing for Memories Recap. Pay only for processed size.",
};

export default async function PricingPage() {
  const user = await getOptionalUser();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link
          href={user ? "/billing" : "/"}
          className="min-h-11 px-2 text-sm text-neutral-500"
        >
          {user ? "Billing" : "Home"}
        </Link>
      </header>

      <section className="mt-10 space-y-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Pricing</h1>
          <p className="mt-2 text-neutral-500">
            Clear prices. Pack credits expire after 90 days. Pro monthly credits
            last 365 days so unused balance can carry across months.
          </p>
        </div>

        <div className="overflow-x-auto rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-800">Free vs Pro</p>
          <table className="mt-4 w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="pb-2 pr-3 font-medium">Feature</th>
                <th className="pb-2 pr-3 font-medium">Free</th>
                <th className="pb-2 font-medium">Pro</th>
              </tr>
            </thead>
            <tbody className="text-neutral-700">
              <tr className="border-b border-neutral-100">
                <td className="py-2.5 pr-3">Watermark</td>
                <td className="py-2.5 pr-3">
                  Light overlay (removed with a credit pack)
                </td>
                <td className="py-2.5">None (end card kept)</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5 pr-3">Output</td>
                <td className="py-2.5 pr-3">Full HD</td>
                <td className="py-2.5">Up to 4K</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5 pr-3">Highlights cut</td>
                <td className="py-2.5 pr-3">—</td>
                <td className="py-2.5">Yes</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2.5 pr-3">Archive</td>
                <td className="py-2.5 pr-3">~30 days</td>
                <td className="py-2.5">~90 days</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3">AI scoring</td>
                <td className="py-2.5 pr-3">Standard</td>
                <td className="py-2.5">Stronger Pro vision</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs text-neutral-500">
            Credit packs remove the overlay watermark; Pro adds 4K, stronger AI,
            highlights, longer archive.
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Free</p>
          <p className="mt-2 text-3xl font-medium">{FREE_CREDITS} credits</p>
          <p className="mt-2 text-sm text-neutral-500">
            On signup · music + moods included · light watermark · brand end
            card
          </p>
        </div>

        <div className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <div>
            <p className="text-sm text-neutral-500">Pro Monthly</p>
            <p className="mt-2 text-3xl font-medium">${PRODUCT_USD.subscription}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {PRODUCT_CREDITS.subscription} credits / month · stronger AI · 4K
              output · highlights · 90-day archive · no overlay watermark · end
              card kept · cancel anytime
            </p>
          </div>
          {user ? (
            <BuyButton product="subscription" label="Subscribe monthly" />
          ) : (
            <GoogleSignInButton
              callbackUrl="/pricing"
              label="Sign in to subscribe"
            />
          )}
        </div>

        <div className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <div>
            <p className="text-sm text-neutral-500">Pro Annual</p>
            <p className="mt-2 text-3xl font-medium">$170</p>
            <p className="mt-1 text-sm text-neutral-500">
              Same Pro benefits · ~2 months free vs monthly · honest discount for
              people who stay. Email support to enable annual checkout while we
              finish wiring the product in Gumroad (Creem fallback if configured).
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
            Credit packs remove the overlay watermark; Pro adds 4K, stronger AI,
            highlights, longer archive.
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
        </div>

        <div className="space-y-3 text-sm text-neutral-500">
          <p className="font-medium text-neutral-800">FAQ</p>
          <p>1 credit ≈ 1 MB processed (minimum 10 per job).</p>
          <p>If processing fails on our side, credits are restored.</p>
          <p>
            Checkout is powered by Gumroad (primary) with Creem as fallback.
            After payment, credits land on your Memories Recap account
            automatically.
          </p>
          <p>Manage cards and memberships from the billing portal / Gumroad library.</p>
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
