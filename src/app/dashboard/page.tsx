import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listJobsForUser } from "@/lib/jobs";
import { STAGE_LABELS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard · Memory Recap",
  description: "Your past recaps and processing jobs.",
};

type Tab = "memories" | "drafted";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const jobs = await listJobsForUser(user.id);
  const params = await searchParams;
  const activeTab: Tab =
    params.tab === "drafted" ? "drafted" : "memories";

  // Memories = completed jobs with recaps
  const memories = jobs.filter((j) => j.status === "completed");
  // Drafted = everything else (uploading, pending, analyzing, selecting, building, rendering, queued, failed)
  const drafted = jobs.filter((j) => j.status !== "completed");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || "User"}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-800">
              {(user.name || user.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-display text-[20px] font-semibold tracking-tight text-green-900">
            Memory Recap
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/upload" className="min-h-11 px-2 text-sm text-neutral-500">
            Upload
          </a>
          <a href="/billing" className="min-h-11 px-2 text-sm text-neutral-500">
            Billing
          </a>
        </div>
      </header>

      {/* Tabs */}
      <div className="mt-8 flex gap-2">
        <a
          href="/dashboard?tab=memories"
          className={`rounded-[12px] px-5 py-2.5 text-sm font-medium transition ${
            activeTab === "memories"
              ? "bg-green-700 text-white shadow-sm"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Memories ({memories.length})
        </a>
        <a
          href="/dashboard?tab=drafted"
          className={`rounded-[12px] px-5 py-2.5 text-sm font-medium transition ${
            activeTab === "drafted"
              ? "bg-green-700 text-white shadow-sm"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Drafted ({drafted.length})
        </a>
      </div>

      <section className="mt-6 space-y-4">
        {activeTab === "memories" ? (
          memories.length === 0 ? (
            <div className="rounded-[16px] bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
              <p className="text-lg font-medium text-neutral-700">
                No memories yet
              </p>
              <p className="mt-1">
                Upload some videos to create your first recap.
              </p>
              <a
                href="/upload"
                className="mt-4 inline-block rounded-[12px] bg-green-700 px-5 py-2.5 text-sm font-medium text-white"
              >
                Upload memories
              </a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {memories.map((job) => (
                <a
                  key={job.id}
                  href={`/result/${job.id}`}
                  className="group block overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm transition hover:shadow-md"
                >
                  {/* Thumbnail placeholder — uses gradient since we don't have video thumbnails yet */}
                  <div className="relative aspect-video bg-[linear-gradient(135deg,#166534_0%,#052e16_55%,#14532d_100%)]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="h-10 w-10 text-white/60"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                        />
                      </svg>
                    </div>
                    <div className="absolute bottom-2 left-2 rounded-[8px] bg-black/50 px-2 py-0.5 text-xs text-white/90">
                      {job.file_count} video{job.file_count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-neutral-900 group-hover:text-green-800">
                      {job.title || `Recap · ${job.file_count} videos`}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {new Date(job.completed_at || job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )
        ) : drafted.length === 0 ? (
          <div className="rounded-[16px] bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
            <p className="text-lg font-medium text-neutral-700">
              No drafts
            </p>
            <p className="mt-1">
              Any jobs you haven&apos;t completed yet will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {drafted.map((job) => {
              const href =
                job.status === "failed"
                  ? `/processing/${job.id}`
                  : `/processing/${job.id}`;
              return (
                <li key={job.id}>
                  <a
                    href={href}
                    className="block rounded-[16px] bg-neutral-50 px-4 py-4 shadow-sm transition hover:bg-neutral-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {job.title || `Draft · ${job.file_count} videos`}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                          {new Date(job.created_at).toLocaleString()} ·{" "}
                          {STAGE_LABELS[job.status] || job.status}
                        </p>
                      </div>
                      <span className="text-sm text-neutral-500">
                        {job.status === "failed"
                          ? "Retry"
                          : `${job.progress}%`}
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <a
          href="/upload"
          className="block rounded-[16px] bg-green-700 py-3.5 text-center text-sm font-medium text-white transition hover:bg-green-800"
        >
          Create a new recap
        </a>
      </div>
    </main>
  );
}
