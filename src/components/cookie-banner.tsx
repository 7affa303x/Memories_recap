"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const COOKIE_CONSENT_KEY = "mr_cookie_consent";
export const COOKIE_CONSENT_EVENT = "mr-cookie-consent";

function pixelsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_META_PIXEL_ID ||
      process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID
  );
}

/**
 * Soft consent banner — only shown when ad pixels are configured.
 * Stores accept/decline in localStorage; AnalyticsPixels listens for updates.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pixelsConfigured()) return;
    try {
      const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function setConsent(value: "accepted" | "declined") {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
      window.dispatchEvent(
        new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value })
      );
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto flex max-w-lg flex-col gap-3 rounded-[16px] border border-neutral-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="text-sm text-neutral-600">
          We use essential cookies to keep you signed in. Optional analytics
          pixels help us measure ads — only if you accept.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-11 flex-1 rounded-[16px]"
            onClick={() => setConsent("accepted")}
          >
            Accept
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 flex-1 rounded-[16px] bg-neutral-50"
            onClick={() => setConsent("declined")}
          >
            Decline
          </Button>
        </div>
        <a
          href="/privacy"
          className="text-center text-xs text-neutral-500 underline"
        >
          Privacy policy
        </a>
      </div>
    </div>
  );
}
