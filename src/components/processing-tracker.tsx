"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { JobCancelButton } from "@/components/job-cancel-button";
import { STAGE_LABELS, formatEta, type JobRow } from "@/lib/types";
import {
  creditsRestoredLine,
  processingCareLine,
} from "@/lib/greeting";

const STAGES = [
  "ingesting",
  "selecting",
  "timeline_ready",
  "building",
  "rendering",
] as const;

function notifyRecapReady() {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (typeof Notification !== "function") return;
    if (Notification.permission !== "granted") return;
    new Notification("Memories Recap is ready", {
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
  const [notifyOptIn, setNotifyOptIn] = useState<"idle" | "granted" | "denied">(
    "idle"
  );

  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        setNotifyOptIn("granted");
      }
    } catch {
      // ignore
    }
  }, []);

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

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, router]);

  async function enableNotifications() {
    try {
      if (!("Notification" in window) || typeof Notification !== "function") {
        setNotifyOptIn("denied");
        return;
      }
      const result = await Notification.requestPermission();
      setNotifyOptIn(result === "granted" ? "granted" : "denied");
    } catch {
      setNotifyOptIn("denied");
    }
  }

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
        <p className="mt-2 text-sm text-neutral-500">{processingCareLine()}</p>
        <p className="mt-1 text-xs text-neutral-400">
          You can close this tab — processing continues in the background. Check
          back here or from your dashboard anytime. If email is enabled for your
          account, we&apos;ll notify you when it&apos;s ready.
        </p>
        {notifyOptIn === "idle" ? (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="mt-3 text-sm font-medium text-green-800 underline underline-offset-2"
          >
            Notify me when ready
          </button>
        ) : notifyOptIn === "granted" ? (
          <p className="mt-3 text-xs text-neutral-500">
            We’ll notify you in this browser when it’s ready.
          </p>
        ) : null}
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
          const normalized =
            stage === "analyzing"
              ? "ingesting"
              : STAGES.includes(stage as (typeof STAGES)[number])
                ? stage
                : "ingesting";
          const currentIndex = STAGES.indexOf(
            normalized as (typeof STAGES)[number]
          );
          const itemIndex = STAGES.indexOf(item);
          const done = itemIndex < currentIndex || stage === "completed";
          const active = item === normalized;
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
            {error || "Something went wrong while crafting this recap."}
          </p>
          {failed ? (
            <p className="mt-2 text-xs text-red-600/80">{creditsRestoredLine()}</p>
          ) : null}
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
      ) : (
        <JobCancelButton
          jobId={jobId}
          mode="cancel"
          className="h-11 w-full rounded-[16px] text-sm"
          variant="secondary"
        />
      )}
    </div>
  );
}
