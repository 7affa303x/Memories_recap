"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PaddleProvider } from "@/components/paddle-provider";

/** Loads the signed-in Paddle customer id (ctm_...) for Retain pwCustomer. */
export function PaddleProviderWithCustomer({
  children,
}: {
  children: ReactNode;
}) {
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/credits", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const id =
          (typeof j.paddleCustomerId === "string" && j.paddleCustomerId) ||
          (typeof j.creemCustomerId === "string" &&
          String(j.creemCustomerId).startsWith("ctm_")
            ? j.creemCustomerId
            : null);
        if (id && String(id).startsWith("ctm_")) setCustomerId(id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PaddleProvider paddleCustomerId={customerId}>{children}</PaddleProvider>
  );
}
