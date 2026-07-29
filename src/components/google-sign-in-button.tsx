"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { trackClientEvent } from "@/components/analytics-pixels";

type AnalyticsEvent = "CompleteRegistration" | "Lead";

function eventForLabel(
  label: string,
  eventName?: AnalyticsEvent
): AnalyticsEvent {
  if (eventName) return eventName;
  if (/sign\s*up|create\s*(an\s*)?account|register|join/i.test(label)) {
    return "CompleteRegistration";
  }
  return "Lead";
}

export function GoogleSignInButton({
  callbackUrl = "/upload",
  label = "Continue with Google",
  eventName,
}: {
  callbackUrl?: string;
  label?: string;
  /** Override analytics event. Defaults to Lead; SignUp-style labels use CompleteRegistration. */
  eventName?: AnalyticsEvent;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      className="h-12 w-full rounded-[16px] text-base"
      disabled={pending}
      onClick={() => {
        setPending(true);
        trackClientEvent(eventForLabel(label, eventName));
        void signIn("google", { callbackUrl }).finally(() => {
          setPending(false);
        });
      }}
    >
      {pending ? "Connecting…" : label}
    </Button>
  );
}
