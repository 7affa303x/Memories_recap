import Link from "next/link";
import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { BuyButton } from "@/components/buy-button";
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
            Clear prices. Credits expire after 90 days. System failures restore
            credits.
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Free</p>
          <p className="mt-2 text-3xl font-medium">{FREE_CREDITS} credits</p>
          <p className="mt-2 text-sm text-neutral-500">
            One-time for new accounts · ~{FREE_CREDITS} MB processed
          </p>
        </div>

        <div className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <div>
            <p className="text-sm text-neutral-500">Pro Monthly</p>
            <p className="mt-2 text-3xl font-medium">${PRODUCT_USD.subscription}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {PRODUCT_CREDITS.subscription} credits / month · cancel anytime
            </p>
          </div>
          {user ? (
            <BuyButton product="subscription" label="Subscribe" />
          ) : (
            <GoogleSignInButton
              callbackUrl="/pricing"
              label="Sign in to subscribe"
            />
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-medium">Credit packs</h2>
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
          <p>Manage cards and cancellations in the billing portal.</p>
        </div>
      </section>
    </main>
  );
}
