"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function AccountActions({
  email,
  userId,
  referralsEnabled,
}: {
  email: string;
  userId: string;
  referralsEnabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!referralsEnabled) return;
    let cancelled = false;
    fetch("/api/referrals")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { inviteUrl?: string } | null) => {
        if (!cancelled && data?.inviteUrl) setInviteUrl(data.inviteUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [referralsEnabled]);

  const fallbackInvite = `/?ref=${encodeURIComponent(userId)}`;

  async function copyInvite() {
    const url =
      inviteUrl ||
      (typeof window !== "undefined"
        ? `${window.location.origin}${fallbackInvite}`
        : fallbackInvite);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
        <p className="text-sm text-neutral-500">Signed in as</p>
        <p className="mt-2 text-lg font-medium break-all">{email}</p>
      </div>

      <div className="grid gap-3">
        <Button asChild className="h-12 rounded-[16px] text-base">
          <a href="/api/account/export" download>
            Download my data (JSON)
          </a>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="h-12 rounded-[16px] bg-white text-base shadow-sm"
        >
          <a href="/api/account/invoices" download>
            Download receipts (JSON)
          </a>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="h-12 rounded-[16px] bg-white text-base shadow-sm"
        >
          <a href="/moments">Moments & rewards</a>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="h-12 rounded-[16px] bg-white text-base shadow-sm"
        >
          <a href="/billing">Billing history</a>
        </Button>
      </div>

      {referralsEnabled ? (
        <div className="space-y-3 rounded-[16px] bg-neutral-50 p-5 shadow-sm">
          <p className="text-sm font-medium">Invite a friend</p>
          <p className="text-sm text-neutral-500">
            Share your link. Friends can sign up with{" "}
            <code className="text-xs">?ref=</code> — rewards come later.
          </p>
          <p className="break-all rounded-[12px] bg-white px-3 py-2 text-xs text-neutral-700">
            {inviteUrl || fallbackInvite}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-[16px] bg-white text-sm shadow-sm"
            onClick={copyInvite}
          >
            {copied ? "Copied" : "Copy invite link"}
          </Button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-[16px] border border-red-100 bg-red-50/60 p-5">
        <p className="text-sm font-medium text-red-900">Delete account</p>
        <p className="text-sm text-red-800/80">
          Soft-deletes your profile, removes billing balance records, and clears
          job listings. You will be signed out. This cannot be undone from the
          app.
        </p>
        {!confirming ? (
          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full rounded-[16px] border border-red-200 bg-white text-base text-red-800"
            onClick={() => setConfirming(true)}
          >
            Delete my account…
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-red-900">
              Really delete {email}? This is permanent from your side.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <form action="/api/account/delete" method="post">
                <Button
                  type="submit"
                  className="h-12 w-full rounded-[16px] bg-red-700 text-base hover:bg-red-800"
                >
                  Yes, delete
                </Button>
              </form>
              <Button
                type="button"
                variant="secondary"
                className="h-12 rounded-[16px] bg-white text-base"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
