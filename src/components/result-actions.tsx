"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function VersionRestoreButton({
  jobId,
  generation,
  isCurrent,
}: {
  jobId: string;
  generation: number;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isCurrent) return null;

  function restore() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/jobs/${jobId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generation }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not restore");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={restore}
        disabled={pending}
        className="text-sm font-medium text-green-800 underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

export function DeleteOriginalsButton({
  jobId,
  uploadIds,
}: {
  jobId: string;
  uploadIds: string[];
}) {
  const router = useRouter();
  const [done, setDone] = useState(uploadIds.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done || uploadIds.length === 0) {
    return done ? (
      <p className="text-xs text-neutral-500">Original uploads removed.</p>
    ) : null;
  }

  function removeAll() {
    if (
      !window.confirm(
        "Delete original uploads from storage? Your finished recap stays available."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      let failed = 0;
      for (const uploadId of uploadIds) {
        const res = await fetch(
          `/api/jobs/${jobId}/uploads/remove?uploadId=${encodeURIComponent(uploadId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) failed += 1;
      }
      if (failed > 0) {
        setError(`Could not remove ${failed} file(s). Try again.`);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="h-11 w-full rounded-[16px] bg-white text-sm shadow-sm"
        disabled={pending}
        onClick={removeAll}
      >
        {pending ? "Deleting…" : "Delete original uploads"}
      </Button>
      <p className="text-xs text-neutral-500">
        Frees storage after your recap is done. The recap downloads stay.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function RecapRating({
  jobId,
  initialRating,
}: {
  jobId: string;
  initialRating?: number | null;
}) {
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [momentsNote, setMomentsNote] = useState<string | null>(null);

  async function submit(value: number) {
    setSaving(true);
    setError(null);
    setRating(value);
    try {
      const res = await fetch(`/api/jobs/${jobId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save rating");
      if (json.momentsGranted) {
        setMomentsNote(`+${json.momentsGranted} Moments — thank you`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[16px] bg-neutral-50 p-4 shadow-sm">
      <p className="text-sm font-medium">How did this feel?</p>
      <p className="mt-1 text-xs text-neutral-500">
        Optional 1–5 — earns Moments the first time.
      </p>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={saving}
            onClick={() => void submit(n)}
            className={`pressable min-h-11 min-w-11 rounded-xl text-sm font-medium ${
              rating === n
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700"
            }`}
            aria-label={`Rate ${n} out of 5`}
          >
            {n}
          </button>
        ))}
      </div>
      {momentsNote ? (
        <p className="mt-2 animate-float-up text-xs font-medium text-green-700">
          {momentsNote}
        </p>
      ) : null}
      {rating && !momentsNote ? (
        <p className="mt-2 text-xs text-neutral-500">
          Thanks — you rated this {rating}/5.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
