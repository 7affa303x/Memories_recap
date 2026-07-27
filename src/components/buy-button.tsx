"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePaddle } from "@/components/paddle-provider";

export function BuyButton({
  product,
  label,
}: {
  product: "subscription" | "credits_small" | "credits_medium" | "credits_large";
  label: string;
}) {
  const { paddle, ready } = usePaddle();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="h-12 w-full rounded-[16px] text-base"
        disabled={pending || !ready}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Checkout failed");
            if (!json.transactionId) {
              throw new Error("Missing transaction id");
            }
            if (!paddle) {
              throw new Error("Paddle.js is not ready");
            }
            paddle.Checkout.open({ transactionId: json.transactionId });
            setPending(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout failed");
            setPending(false);
          }
        }}
      >
        {pending ? "Opening checkout…" : label}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
