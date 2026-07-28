"use client";

import { useEffect } from "react";
import { trackClientEvent } from "@/components/analytics-pixels";

export function CheckoutSuccessBeacon({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    trackClientEvent("Purchase");
  }, [active]);
  return null;
}
