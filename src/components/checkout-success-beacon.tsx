"use client";

import { useEffect, useRef, useState } from "react";
import { trackClientEvent } from "@/components/analytics-pixels";

export function CheckoutSuccessBeacon({
  active,
  initialBalance,
}: {
  active: boolean;
  initialBalance: number;
}) {
  const [pending, setPending] = useState(active);
  const [balance, setBalance] = useState(initialBalance);
  const tracked = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (!tracked.current) {
      trackClientEvent("Purchase");
      tracked.current = true;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch("/api/billing/credits", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (typeof json.balance === "number") {
          setBalance(json.balance);
          if (json.balance > initialBalance) {
            setPending(false);
            return;
          }
        }
      } catch {
        /* keep pending */
      }
      if (attempts < 20 && !cancelled) {
        timer = setTimeout(poll, 2500);
      } else if (!cancelled) {
        // Stop polling; leave a soft pending note
        setPending(false);
      }
    }

    timer = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, initialBalance]);

  if (!active) return null;

  if (pending) {
    return (
      <p className="mb-4 rounded-[16px] bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Payment received — credits pending confirmation. Balance still shows{" "}
        {balance}. This usually updates within a few seconds.
      </p>
    );
  }

  if (balance > initialBalance) {
    return (
      <p className="mb-4 rounded-[16px] bg-green-50 px-4 py-3 text-sm text-green-800">
        Credits updated — you now have {balance} available.
      </p>
    );
  }

  return null;
}
