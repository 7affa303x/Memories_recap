import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listJobsForUser } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { JobCancelButton } from "@/components/job-cancel-button";
import { dashboardCareLine, welcomeLine } from "@/lib/greeting";

export const metadata: Metadata = {
  title: "Dashboard · Memories Recap",
  description: "Your past recaps and processing jobs.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const jobs = await listJobsForUser(user.id);
  const folders = [
    ...new Set(
      jobs
        .map((j) => j.folder || j.recap_options?.folder || null)
        .filter((f): f is string => Boolean(f))
    ),
  ].sort();
  const activeFolder = params.folder || null;
  const visible = activeFolder
    ? jobs.filter(
        (j) => (j.folder || j.recap_options?.folder || null) === activeFolder
      )
    : jobs;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader active="dashboard" />

      <section className="mt-10 space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-green-800">
              {welcomeLine({ name: user.name })}
            </p>
            <h1 className="mt-2 text-2xl font-medium tracking-tight">
              Your recaps
            </h1>
            <p className="mt-2 text-neutral-500">
              {dashboardCareLine(jobs.length)}
            </p>
          </div>
          <Button asChild className="h-11 rounded-[16px]">
            <Link href="/upload">New</Link>
          </Button>
        </div>

        {folders.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
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
                href={`/dashboard?folder=${encodeURIComponent(folder)}`}
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

        <ul className="space-y-3">
          {visible.length === 0 ? (
            <li className="rounded-[16px] bg-[radial-gradient(600px_240px_at_50%_0%,#dcfce7,transparent),#fafafa] px-5 py-10 text-center shadow-sm">
              <p className="font-display text-xl font-semibold tracking-tight text-green-900">
                No recaps yet
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500">
                Upload a few phone videos and we&apos;ll turn them into one calm
                watchable story.
              </p>
              <Button asChild className="mt-6 h-12 rounded-[16px] px-8 text-base">
                <Link href="/upload">Create your first recap</Link>
              </Button>
            </li>
          ) : (
            visible.map((job) => {
              const href =
                job.status === "completed"
                  ? `/result/${job.id}`
                  : `/processing/${job.id}`;
              const folder = job.folder || job.recap_options?.folder;
              return (
                <li
                  key={job.id}
                  className="rounded-[16px] bg-neutral-50 px-4 py-4 shadow-sm"
                >
                  <Link
                    href={href}
                    className="block transition hover:opacity-90"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {job.title || `Recap · ${job.file_count} videos`}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                          {folder ? `${folder} · ` : ""}
                          {new Date(job.created_at).toLocaleString()} ·{" "}
                          {STAGE_LABELS[job.status] || job.status}
                          {job.recap_generation
                            ? ` · v${job.recap_generation}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-sm text-neutral-500">
                        {job.status === "completed"
                          ? "Open"
                          : job.status === "failed"
                            ? "Retry"
                            : job.status === "cancelled"
                              ? "Cancelled"
                              : `${job.progress}%`}
                      </span>
                    </div>
                  </Link>
                  <div className="mt-3">
                    {job.status === "completed" ||
                    job.status === "cancelled" ||
                    job.status === "failed" ? (
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
            })
          )}
        </ul>
      </section>
    </main>
  );
}
