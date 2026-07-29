import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listJobsForUser } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/types";
import { AppHeader } from "@/components/app-header";

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
            <h1 className="text-2xl font-medium tracking-tight">Your recaps</h1>
            <p className="mt-2 text-neutral-500">
              History, folders, and versions — built to keep coming back.
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
            <li className="rounded-[16px] bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
              No recaps yet. Upload a few videos to start.
            </li>
          ) : (
            visible.map((job) => {
              const href =
                job.status === "completed"
                  ? `/result/${job.id}`
                  : `/processing/${job.id}`;
              const folder = job.folder || job.recap_options?.folder;
              return (
                <li key={job.id}>
                  <Link
                    href={href}
                    className="block rounded-[16px] bg-neutral-50 px-4 py-4 shadow-sm transition hover:bg-neutral-100"
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
                            : `${job.progress}%`}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </main>
  );
}
