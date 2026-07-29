"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
} from "@/components/cookie-banner";

/**
 * Optional ad pixels. Set NEXT_PUBLIC_META_PIXEL_ID / NEXT_PUBLIC_TIKTOK_PIXEL_ID.
 * Loads only after soft cookie consent when pixels are configured.
 */
export function AnalyticsPixels() {
  const metaId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const tiktokId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  const configured = Boolean(metaId || tiktokId);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!configured) return;
    function read() {
      try {
        setAllowed(window.localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted");
      } catch {
        setAllowed(false);
      }
    }
    read();
    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setAllowed(detail === "accepted");
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
  }, [configured]);

  if (!configured || !allowed) return null;

  return (
    <>
      {metaId ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaId}');
            fbq('track', 'PageView');
          `}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      ) : null}

      {tiktokId ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
            ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
            ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
            for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
            ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
            ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
            ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
            var a=document.createElement("script");a.type="text/javascript";a.async=!0;a.src=r+"?sdkid="+e+"&lib="+t;
            var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(a,s)};
            ttq.load('${tiktokId}');
            ttq.page();
          }(window, document, 'ttq');
        `}</Script>
      ) : null}
    </>
  );
}

export function trackClientEvent(
  name: "CompleteRegistration" | "InitiateCheckout" | "Purchase" | "Lead",
  params?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted") return;
  } catch {
    return;
  }
  const w = window as Window & {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, payload?: Record<string, unknown>) => void };
  };
  try {
    w.fbq?.("track", name, params || {});
    const ttMap: Record<string, string> = {
      CompleteRegistration: "CompleteRegistration",
      InitiateCheckout: "InitiateCheckout",
      Purchase: "CompletePayment",
      Lead: "ClickButton",
    };
    w.ttq?.track(ttMap[name] || name, params);
  } catch {
    // ignore
  }
}
