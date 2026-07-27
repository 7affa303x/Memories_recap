"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { STAGE_LABELS, type JobRow } from "@/lib/types";

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
    // Some mobile browsers disallow `new Notification()` outside a service worker.
  }
}

export function ProcessingTracker({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRow | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          setError(nextJob.error || "Processing failed");
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
      // Ignore unsupported notification permission flows.
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, router]);

  const progress = job?.progress ?? 5;
  const stage = job?.stage || job?.status || "analyzing";
  const eta = job?.eta_seconds;

  return (
    <div className="mt-10 space-y-8">
      <div>
        <p className="text-sm text-neutral-500">Working on your recap</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">
          {STAGE_LABELS[stage] || "Processing"}
        </h1>
      </div>

      <div className="rounded-[16px] bg-neutral-50 p-5 shadow-sm">
        <Progress value={progress} className="h-2" />
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
          <span>{progress}%</span>
          <span>
            {typeof eta === "number" && eta > 0
              ? `About ${Math.max(1, Math.ceil(eta / 60))} min left`
              : "Finishing up"}
          </span>
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

      <p className="text-sm text-neutral-500">
        You can close this page. Processing continues, and we will notify you
        when it is finished.
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
