"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  callbackUrl = "/upload",
  label = "Upload memories",
}: {
  callbackUrl?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      className="h-12 w-full rounded-[16px] text-base"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signIn("google", { callbackUrl }).finally(() => {
          setPending(false);
        });
      }}
    >
      {pending ? "Connecting…" : label}
    </Button>
  );
}
