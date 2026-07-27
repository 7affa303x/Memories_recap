import Link from "next/link";
import { getOptionalUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { BuyButton } from "@/components/buy-button";
import { FREE_CREDITS, PRODUCT_CREDITS } from "@/lib/billing/config";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default async function PricingPage() {
  const user = await getOptionalUser();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href={user ? "/billing" : "/"} className="min-h-11 px-2 text-sm text-neutral-500">
          {user ? "Billing" : "Home"}
        </Link>
      </header>

      <section className="mt-10 space-y-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Pricing</h1>
          <p className="mt-2 text-neutral-500">
            Pay only for processed size. Credits expire after 90 days.
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Free</p>
          <p className="mt-2 text-3xl font-medium">{FREE_CREDITS} credits</p>
          <p className="mt-2 text-sm text-neutral-500">
            One-time allowance for new accounts. Cannot be reset.
          </p>
        </div>

        <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm space-y-4">
          <div>
            <p className="text-sm text-neutral-500">Pro Monthly</p>
            <p className="mt-2 text-3xl font-medium">
              {PRODUCT_CREDITS.subscription} credits / month
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Recurring subscription. Cancel anytime. Access continues until
              period end.
            </p>
          </div>
          {user ? (
            <BuyButton product="subscription" label="Subscribe" />
          ) : (
            <GoogleSignInButton callbackUrl="/pricing" label="Sign in to subscribe" />
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-medium">Credit packs</h2>
          {(
            [
              ["credits_small", "Small", PRODUCT_CREDITS.credits_small],
              ["credits_medium", "Medium", PRODUCT_CREDITS.credits_medium],
              ["credits_large", "Large", PRODUCT_CREDITS.credits_large],
            ] as const
          ).map(([product, name, credits]) => (
            <div
              key={product}
              className="rounded-[16px] bg-neutral-50 p-5 shadow-sm space-y-4"
            >
              <div>
                <p className="text-sm text-neutral-500">{name} pack</p>
                <p className="mt-2 text-2xl font-medium">{credits} credits</p>
                <p className="mt-2 text-sm text-neutral-500">
                  One-time purchase. Valid for 90 days.
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
      </section>
    </main>
  );
}
