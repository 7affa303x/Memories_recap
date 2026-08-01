"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trackClientEvent } from "@/components/analytics-pixels";
import type { ProductKey } from "@/lib/billing/types";
import type { BillingInterval } from "@/lib/billing/pricing";

export function BuyButton({
  product,
  label,
  interval,
}: {
  product: ProductKey;
  label: string;
  interval?: BillingInterval;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
