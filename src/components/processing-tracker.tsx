"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, formatEta, type JobRow } from "@/lib/types";

const STAGES = ["analyzing", "selecting", "building", "rendering"] as const;

function notifyRecapReady() {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (typeof Notification !== "function") return;
    if (Notification.permission !== "granted") return;
    new Notification("Memory Recap is ready", {
      body: "Your recap finished processing.",
    });
  } catch {
    // ignore
  }
}

export function ProcessingTracker({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load job");
        if (cancelled) return;

        const nextJob = json.job as JobRow;
        setJob(nextJob);
        setError(null);

        if (nextJob.status === "completed") {
          notifyRecapReady();
          router.replace(`/result/${jobId}`);
          return;
        }

        if (nextJob.status === "failed") {
          setError(nextJob.error || "Processing failed. Credits were restored.");
          return;
        }

        timer = setTimeout(tick, 2000);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Connection issue");
          timer = setTimeout(tick, 4000);
        }
      }
    }

    tick();
    try {
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    } catch {
      // ignore
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, router]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      setJob((current) =>
        current
          ? { ...current, status: "queued", stage: "queued", progress: 3, error: null }
          : current
      );
      // resume polling via remount-ish: reset by location reload
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
      setRetrying(false);
    }
  }

  const progress = job?.progress ?? 5;
  const stage = job?.stage || job?.status || "analyzing";
  const failed = job?.status === "failed";
  const showError = failed || Boolean(error);

  return (
    <div className="mt-10 space-y-8">
      <div>
        <p className="text-sm text-neutral-500">Working on your recap</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">
          {STAGE_LABELS[stage] || "Processing"}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Keep this tab open for live progress. You can also return later from
          your dashboard.
        </p>
      </div>

      <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
        <Progress value={progress} className="h-2" />
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
          <span>{progress}%</span>
          <span>{formatEta(job?.eta_seconds)}</span>
        </div>
      </div>

      <ol className="space-y-3">
        {STAGES.map((item) => {
          const currentIndex = STAGES.indexOf(
            (STAGES.includes(stage as (typeof STAGES)[number])
              ? stage
              : "analyzing") as (typeof STAGES)[number]
          );
          const itemIndex = STAGES.indexOf(item);
          const done = itemIndex < currentIndex || stage === "completed";
          const active = item === stage;
          return (
            <li
              key={item}
              className={`rounded-[16px] px-4 py-3 text-sm ${
                active
                  ? "bg-neutral-900 text-white"
                  : done
                    ? "bg-neutral-50 text-neutral-700"
                    : "bg-neutral-50 text-neutral-400"
              }`}
            >
              {STAGE_LABELS[item]}
            </li>
          );
        })}
      </ol>

      {showError ? (
        <div className="space-y-3 rounded-[16px] bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error ||
              "Processing failed. If this was a system error, credits were restored."}
          </p>
          {failed ? (
            <div className="grid gap-3">
              <Button
                className="h-12 rounded-[16px]"
                onClick={retry}
                disabled={retrying}
              >
                {retrying ? "Retrying…" : "Retry processing"}
              </Button>
              <Button asChild variant="secondary" className="h-12 rounded-[16px]">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
