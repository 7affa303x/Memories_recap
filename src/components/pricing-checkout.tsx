"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trackClientEvent } from "@/components/analytics-pixels";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import {
  PRODUCT_CREDITS,
  PRODUCT_USD,
} from "@/lib/billing/config";
import {
  annualListPrice,
  quotePrice,
  type BillingInterval,
} from "@/lib/billing/pricing";
import type { ProductKey } from "@/lib/billing/types";

function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-neutral-100 p-1 text-sm">
      {(["monthly", "annual"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`min-h-9 rounded-full px-3 font-medium transition ${
            value === opt
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500"
          }`}
        >
          {opt === "monthly" ? "Monthly" : "Yearly · save 2 mo"}
        </button>
      ))}
    </div>
  );
}

function CheckoutButton({
  product,
  interval,
  label,
  signedIn,
}: {
  product: ProductKey;
  interval?: BillingInterval;
  label: string;
  signedIn: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <GoogleSignInButton callbackUrl="/pricing" label="Sign in to continue" />
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="h-12 w-full rounded-[16px] text-base"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          trackClientEvent("InitiateCheckout", { product, interval });
          try {
            const res = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product, interval }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Checkout failed");
            if (!json.url) throw new Error("Missing checkout URL");
            window.location.href = json.url;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout failed");
            setPending(false);
          }
        }}
      >
        {pending ? "Redirecting…" : label}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function PlanCard({
  product,
  title,
  blurb,
  signedIn,
  packBuyerDiscount,
  accent,
}: {
  product: "subscription" | "subscription_ultra";
  title: string;
  blurb: string;
  signedIn: boolean;
  packBuyerDiscount: boolean;
  accent?: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const quote = quotePrice({
    product,
    interval,
    packBuyerDiscount: interval === "monthly" && packBuyerDiscount,
  });

  return (
    <div
      className={`space-y-4 rounded-[16px] p-5 shadow-sm ${
        accent
          ? "border border-green-200 bg-green-50/60"
          : "bg-neutral-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-sm font-medium ${
              accent ? "text-green-900" : "text-neutral-500"
            }`}
          >
            {title}
          </p>
          <p className="mt-2 text-3xl font-medium tracking-tight">
            {quote.chargeUsd < quote.listUsd ? (
              <>
                <span className="mr-2 text-neutral-400 line-through">
                  ${quote.listUsd}
                </span>
                ${quote.chargeUsd}
              </>
            ) : (
              <>${quote.chargeUsd}</>
            )}
            <span className="ml-1 text-base font-normal text-neutral-500">
              /{interval === "annual" ? "yr" : "mo"}
            </span>
          </p>
          {quote.discountLabel ? (
            <p className="mt-1 text-xs font-medium text-green-800">
              {quote.discountLabel}
            </p>
          ) : null}
        </div>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <p className="text-sm text-neutral-600">
        {quote.credits.toLocaleString()} credits
        {interval === "annual" ? " / year" : " / month"} · {blurb}
      </p>
      {interval === "monthly" ? (
        <button
          type="button"
          className="text-sm font-medium text-green-800 underline-offset-2 hover:underline"
          onClick={() => setInterval("annual")}
        >
          Switch to yearly — ${annualListPrice(PRODUCT_USD[product])}/yr (2 months free)
        </button>
      ) : (
        <button
          type="button"
          className="text-sm text-neutral-500 underline-offset-2 hover:underline"
          onClick={() => setInterval("monthly")}
        >
          Back to monthly (${PRODUCT_USD[product]}/mo)
        </button>
      )}
      <CheckoutButton
        product={product}
        interval={interval}
        signedIn={signedIn}
        label={
          interval === "annual"
            ? `Get ${title} yearly`
            : `Subscribe to ${title}`
        }
      />
    </div>
  );
}

export function PricingCheckout({
  signedIn,
  packBuyerDiscount,
  memberTier,
  showUltra = true,
}: {
  signedIn: boolean;
  packBuyerDiscount: boolean;
  memberTier: "pro" | "ultra" | null;
  showUltra?: boolean;
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-medium tracking-tight">Subscriptions</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Monthly or yearly. Buy credits first and unlock a better plan price
            for 7 days.
          </p>
        </div>
        <PlanCard
          product="subscription"
          title="Pro"
          blurb="stronger AI · 4K · highlights · no overlay watermark"
          signedIn={signedIn}
          packBuyerDiscount={packBuyerDiscount}
        />
        {showUltra ? (
          <PlanCard
            product="subscription_ultra"
            title="Ultra"
            blurb="everything in Pro · priority queue · oversized-file review"
            signedIn={signedIn}
            packBuyerDiscount={packBuyerDiscount}
            accent
          />
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-medium tracking-tight">Credits</h2>
          <p className="mt-1 text-sm text-neutral-500">
            One-time packs · 90 days. Subscribers get a pack discount
            {memberTier
              ? ` (you: ${memberTier === "ultra" ? "15%" : "10%"} off)`
              : ""}.
          </p>
        </div>
        {(
          [
            ["credits_small", "Small"],
            ["credits_medium", "Medium"],
            ["credits_large", "Large"],
          ] as const
        ).map(([product, name]) => {
          const quote = quotePrice({ product, memberTier });
          return (
            <div
              key={product}
              className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm"
            >
              <div>
                <p className="text-sm text-neutral-500">{name} pack</p>
                <p className="mt-2 text-2xl font-medium">
                  {quote.chargeUsd < quote.listUsd ? (
                    <>
                      <span className="mr-2 text-neutral-400 line-through">
                        ${quote.listUsd}
                      </span>
                      ${quote.chargeUsd}
                    </>
                  ) : (
                    <>${quote.listUsd}</>
                  )}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {PRODUCT_CREDITS[product]} credits · one-time · 90 days
                </p>
                {quote.discountLabel ? (
                  <p className="mt-1 text-xs font-medium text-green-800">
                    {quote.discountLabel}
                  </p>
                ) : null}
              </div>
              <CheckoutButton
                product={product}
                signedIn={signedIn}
                label={`Buy ${name.toLowerCase()}`}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}
