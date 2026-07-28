import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listJobsForUser } from "@/lib/jobs";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard · Memory Recap",
  description: "Your past recaps and processing jobs.",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const jobs = await listJobsForUser(user.id);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/upload" className="min-h-11 px-2 text-sm text-neutral-500">
            Upload
          </Link>
          <Link href="/billing" className="min-h-11 px-2 text-sm text-neutral-500">
            Billing
          </Link>
        </div>
      </header>

      <section className="mt-10 space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Your recaps</h1>
            <p className="mt-2 text-neutral-500">History of every job.</p>
          </div>
          <Button asChild className="h-11 rounded-[16px]">
            <Link href="/upload">New</Link>
          </Button>
        </div>

        <ul className="space-y-3">
          {jobs.length === 0 ? (
            <li className="rounded-[16px] bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
              No recaps yet. Upload a few videos to start.
            </li>
          ) : (
            jobs.map((job) => {
              const href =
                job.status === "completed"
                  ? `/result/${job.id}`
                  : job.status === "failed"
                    ? `/processing/${job.id}`
                    : `/processing/${job.id}`;
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
                          {new Date(job.created_at).toLocaleString()} ·{" "}
                          {STAGE_LABELS[job.status] || job.status}
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
