"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MOODS = [
  { id: "joyful", label: "Joyful" },
  { id: "nostalgic", label: "Nostalgic" },
  { id: "chill", label: "Chill" },
  { id: "epic", label: "Epic" },
] as const;

export function RemixPanel({
  jobId,
  currentMood,
}: {
  jobId: string;
  currentMood: string;
}) {
  const router = useRouter();
  const [mood, setMood] = useState(currentMood);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remix() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/jobs/${jobId}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, musicMode: "auto" }),
      });
      const json = await res.json();
      if (res.status === 402) {
        setError(`Need ${json.creditsRequired} credits to remix.`);
        return;
      }
      if (!res.ok) {
        setError(json.error || "Remix failed");
        return;
      }
      router.push(`/processing/${jobId}`);
    });
  }

  return (
    <div className="space-y-3 rounded-[16px] bg-neutral-50 p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium">Remix mood</p>
        <p className="mt-1 text-xs text-neutral-500">
          Rebuild from the same uploads without re-uploading. Half credit cost.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMood(m.id)}
            className={`min-h-11 rounded-xl px-2 text-sm ${
              mood === m.id
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button
        type="button"
        className="h-11 w-full rounded-[16px]"
        disabled={pending}
        onClick={remix}
      >
        {pending ? "Starting…" : "Remix recap"}
      </Button>
    </div>
  );
}
