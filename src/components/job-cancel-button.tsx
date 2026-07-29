"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  jobId: string;
  /** completed → soft-hide; otherwise cancel in-progress / remove failed */
  mode?: "cancel" | "remove";
  label?: string;
  className?: string;
  /** After success: navigate here (default /dashboard for cancel). */
  redirectTo?: string | null;
  variant?: "default" | "secondary" | "ghost" | "outline" | "destructive";
};

export function JobCancelButton({
  jobId,
  mode = "cancel",
  label,
  className,
  redirectTo = "/dashboard",
  variant = "secondary",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLabel =
    mode === "remove" ? "Remove from list" : "Cancel";

  async function onClick() {
    if (busy) return;
    const confirmMsg =
      mode === "remove"
        ? "Remove this recap from your list? Files stay until archive expiry."
        : "Cancel this recap? Reserved credits will be restored.";
    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Could not update job");
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={variant}
        className={className || "h-11 rounded-[16px] text-sm"}
        onClick={() => void onClick()}
        disabled={busy}
      >
        {busy ? (mode === "remove" ? "Removing…" : "Cancelling…") : label || defaultLabel}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
