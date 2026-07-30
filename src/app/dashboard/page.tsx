import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getRecap, listJobsForUser } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, type JobRow } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { JobCancelButton } from "@/components/job-cancel-button";
import { StreakBanner } from "@/components/streak-banner";
import { dashboardCareLine, welcomeLine } from "@/lib/greeting";
import { signedRecapUrl } from "@/lib/supabase/admin";
import { getBillingSummary } from "@/lib/billing/credits";

export const metadata: Metadata = {
  title: "Dashboard · Memories Recap",
  description: "Your past recaps and processing jobs.",
};

type Tab = "memories" | "drafted";

function jobHref(job: JobRow) {
  if (job.status === "completed") return `/result/${job.id}`;
  if (job.status === "pending" || job.status === "uploading") {
    return `/upload?job=${job.id}`;
  }
  return `/processing/${job.id}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const activeTab: Tab = params.tab === "drafted" ? "drafted" : "memories";
  const jobs = await listJobsForUser(user.id);
  const billing = await getBillingSummary(user.id, user.email).catch(() => null);

  const memories = jobs.filter((j) => j.status === "completed");
  const drafted = jobs.filter((j) => j.status !== "completed");

  const folders = [
    ...new Set(
      jobs
        .map((j) => j.folder || j.recap_options?.folder || null)
        .filter((f): f is string => Boolean(f))
    ),
  ].sort();
  const activeFolder = params.folder || null;

  const tabJobs = activeTab === "memories" ? memories : drafted;
  const visible = activeFolder
    ? tabJobs.filter(
        (j) => (j.folder || j.recap_options?.folder || null) === activeFolder
      )
    : tabJobs;

  const thumbByJob = new Map<string, string | null>();
  await Promise.all(
    visible
      .filter((j) => j.status === "completed")
      .slice(0, 24)
      .map(async (job) => {
        try {
          const recap = await getRecap(job.id, user.id);
          const path = recap?.preview_path || recap?.landscape_path;
          if (!path) {
            thumbByJob.set(job.id, null);
            return;
          }
          thumbByJob.set(job.id, await signedRecapUrl(path, 60 * 30));
        } catch {
          thumbByJob.set(job.id, null);
        }
      })
  );

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader active="dashboard" />

      <section className="mt-8 space-y-6">
        <StreakBanner
          initialStreak={billing?.streakCurrent || 0}
          initialLongest={billing?.streakLongest || 0}
        />

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-green-800">
              {welcomeLine({ name: user.name })}
            </p>
            <h1 className="mt-2 text-2xl font-medium tracking-tight">
              Your memories
            </h1>
            <p className="mt-2 text-neutral-500">
              {dashboardCareLine(memories.length)}
            </p>
          </div>
          <Button asChild className="h-11 rounded-[16px]">
            <Link href="/upload">New</Link>
          </Button>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/dashboard?tab=memories${activeFolder ? `&folder=${encodeURIComponent(activeFolder)}` : ""}`}
            className={`rounded-[12px] px-5 py-2.5 text-sm font-medium transition ${
              activeTab === "memories"
                ? "bg-green-800 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Memories ({memories.length})
          </Link>
          <Link
            href={`/dashboard?tab=drafted${activeFolder ? `&folder=${encodeURIComponent(activeFolder)}` : ""}`}
            className={`rounded-[12px] px-5 py-2.5 text-sm font-medium transition ${
              activeTab === "drafted"
                ? "bg-green-800 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Drafted ({drafted.length})
          </Link>
        </div>

        {folders.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard?tab=${activeTab}`}
              className={`rounded-full px-3 py-2 text-sm ${
                !activeFolder
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              All
            </Link>
            {folders.map((folder) => (
              <Link
                key={folder}
                href={`/dashboard?tab=${activeTab}&folder=${encodeURIComponent(folder)}`}
                className={`rounded-full px-3 py-2 text-sm ${
                  activeFolder === folder
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {folder}
              </Link>
            ))}
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="rounded-[16px] bg-[radial-gradient(600px_240px_at_50%_0%,#dcfce7,transparent),#fafafa] px-5 py-10 text-center shadow-sm">
            <p className="font-display text-xl font-semibold tracking-tight text-green-900">
              {activeTab === "memories" ? "No memories yet" : "No drafts"}
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500">
              {activeTab === "memories"
                ? "Upload a few phone videos and we’ll turn them into one calm watchable story."
                : "Jobs still uploading or processing will show up here."}
            </p>
            <Button asChild className="mt-6 h-12 rounded-[16px] px-8 text-base">
              <Link href="/upload">
                {activeTab === "memories" ? "Create your first recap" : "Upload memories"}
              </Link>
            </Button>
          </div>
        ) : activeTab === "memories" ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {visible.map((job) => {
              const thumb = thumbByJob.get(job.id);
              const folder = job.folder || job.recap_options?.folder;
              return (
                <li key={job.id} className="overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm">
                  <Link href={jobHref(job)} className="block transition hover:opacity-95">
                    <div className="relative aspect-video bg-neutral-900">
                      {thumb ? (
                        <video
                          src={`${thumb}#t=0.4`}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#166534_0%,#052e16_55%,#14532d_100%)]">
                          <span className="text-sm text-white/70">Open recap</span>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-3">
                      <p className="truncate font-medium text-neutral-900">
                        {job.title || `Recap · ${job.file_count} videos`}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {folder ? `${folder} · ` : ""}
                        {new Date(job.created_at).toLocaleString()}
                        {job.recap_generation ? ` · v${job.recap_generation}` : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="px-3 pb-3">
                    <JobCancelButton
                      jobId={job.id}
                      mode="remove"
                      redirectTo={null}
                      variant="ghost"
                      className="h-9 px-0 text-sm text-neutral-500"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-3">
            {visible.map((job) => {
              const folder = job.folder || job.recap_options?.folder;
              return (
                <li
                  key={job.id}
                  className="rounded-[16px] bg-neutral-50 px-4 py-4 shadow-sm"
                >
                  <Link href={jobHref(job)} className="block transition hover:opacity-90">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {job.title || `Draft · ${job.file_count} videos`}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                          {folder ? `${folder} · ` : ""}
                          {new Date(job.created_at).toLocaleString()} ·{" "}
                          {STAGE_LABELS[job.status] || job.status}
                        </p>
                      </div>
                      <span className="text-sm text-neutral-500">
                        {job.status === "failed"
                          ? "Retry"
                          : job.status === "cancelled"
                            ? "Cancelled"
                            : job.status === "pending" || job.status === "uploading"
                              ? "Continue"
                              : `${job.progress}%`}
                      </span>
                    </div>
                  </Link>
                  <div className="mt-3">
                    {job.status === "cancelled" || job.status === "failed" ? (
                      <JobCancelButton
                        jobId={job.id}
                        mode="remove"
                        redirectTo={null}
                        variant="ghost"
                        className="h-9 px-0 text-sm text-neutral-500"
                      />
                    ) : (
                      <JobCancelButton
                        jobId={job.id}
                        mode="cancel"
                        redirectTo={null}
                        variant="ghost"
                        className="h-9 px-0 text-sm text-neutral-500"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
