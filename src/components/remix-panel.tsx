"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MOODS = [
  { id: "joyful", label: "Joyful" },
  { id: "nostalgic", label: "Nostalgic" },
  { id: "chill", label: "Chill" },
  { id: "epic", label: "Epic" },
] as const;

type MusicTrackOption = {
  id: string;
  title: string;
  mood: string;
  vibe: string;
};

export function RemixPanel({
  jobId,
  currentMood,
  currentQuality = "fhd",
  isPro = false,
}: {
  jobId: string;
  currentMood: string;
  currentQuality?: "fhd" | "uhd";
  isPro?: boolean;
}) {
  const router = useRouter();
  const [mood, setMood] = useState(currentMood);
  const [musicMode, setMusicMode] = useState<"auto" | "none">("auto");
  const [trackId, setTrackId] = useState("");
  const [tracks, setTracks] = useState<MusicTrackOption[]>([]);
  const [outputQuality, setOutputQuality] = useState<"fhd" | "uhd">(
    currentQuality === "uhd" ? "uhd" : "fhd"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/music")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.tracks)) setTracks(j.tracks);
      })
      .catch(() => undefined);
  }, []);

  function remix() {
    setError(null);
    startTransition(async () => {
      const useTrack = musicMode === "auto" && trackId;
      const res = await fetch(`/api/jobs/${jobId}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          musicMode: useTrack ? "manual" : musicMode,
          trackId: useTrack ? trackId : null,
          outputQuality: isPro ? outputQuality : "fhd",
        }),
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

      <div>
        <p className="text-sm font-medium">Music</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["auto", "Auto"],
              ["none", "No music"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMusicMode(value)}
              className={`min-h-11 rounded-xl px-3 text-sm ${
                musicMode === value
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {musicMode === "auto" && tracks.length > 0 ? (
          <label className="mt-2 block text-xs text-neutral-500">
            Optional track
            <select
              className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
            >
              <option value="">Auto pick for mood</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.vibe}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {isPro ? (
        <div>
          <p className="text-sm font-medium">Quality</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["fhd", "Full HD"],
                ["uhd", "4K UHD"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutputQuality(value)}
                className={`min-h-11 rounded-xl px-3 text-sm ${
                  outputQuality === value
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            4K only helps when your sources are sharp enough.
          </p>
        </div>
      ) : null}

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
