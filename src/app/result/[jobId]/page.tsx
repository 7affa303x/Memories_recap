import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getJobForUser, getRecap, listUploads } from "@/lib/jobs";
import { signedRecapUrl, getServiceSupabase } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/billing/config";
import { Button } from "@/components/ui/button";
import { ShareControls } from "@/components/share-controls";
import { AppHeader } from "@/components/app-header";
import { RemixPanel } from "@/components/remix-panel";
import Link from "next/link";
import { formatBytes } from "@/lib/types";

type Props = { params: Promise<{ jobId: string }> };

export const metadata: Metadata = {
  title: "Your recap · Memories Recap",
  description: "Watch, download, and share your memory recap.",
};

export default async function ResultPage({ params }: Props) {
  const user = await requireUser();
  const { jobId } = await params;
  const job = await getJobForUser(jobId, user.id);

  if (!job) notFound();
  if (job.status !== "completed") redirect(`/processing/${jobId}`);

  const recap = await getRecap(jobId, user.id);
  if (!recap?.landscape_path) redirect(`/processing/${jobId}`);

  const landscapeUrl = await signedRecapUrl(recap.landscape_path);
  const verticalUrl = recap.vertical_path
    ? await signedRecapUrl(recap.vertical_path)
    : null;
  const highlightsUrl = recap.highlights_path
    ? await signedRecapUrl(recap.highlights_path)
    : null;
  const storyUrl = recap.story_path
    ? await signedRecapUrl(recap.story_path)
    : null;
  const tiktokUrl = recap.tiktok_path
    ? await signedRecapUrl(recap.tiktok_path)
    : null;
  const initialShareUrl = job.share_token
    ? `${getAppUrl()}/s/${job.share_token}`
    : null;

  const uploads = await listUploads(jobId, user.id);
  const supabase = getServiceSupabase();
  const beforeThumbs: string[] = [];
  for (const upload of uploads.slice(0, 4)) {
    const { data } = await supabase.storage
      .from("memories")
      .createSignedUrl(upload.storage_path, 3600);
    if (data?.signedUrl) beforeThumbs.push(data.signedUrl);
  }

  const expiresLabel = recap.expires_at
    ? new Date(recap.expires_at).toLocaleDateString()
    : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader />

      <section className="mt-10 space-y-6">
        <div>
          <p className="text-sm font-medium text-green-700">Success</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Your recap is ready
          </h1>
          <p className="mt-2 text-neutral-500">
            {job.folder ? `${job.folder} · ` : ""}
            Generation v{recap.current_generation || 1}
            {expiresLabel ? ` · kept until ${expiresLabel}` : ""}
          </p>
        </div>

        {beforeThumbs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">Before → after</p>
            <div className="grid grid-cols-4 gap-2">
              {beforeThumbs.map((url) => (
                <video
                  key={url}
                  className="aspect-square w-full rounded-lg bg-black object-cover"
                  src={url}
                  muted
                  playsInline
                  preload="metadata"
                />
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              Sources ({uploads.length} files · {formatBytes(job.total_bytes)})
              condensed into one watchable recap.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm text-neutral-500">Landscape</p>
          <div className="overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm">
            <video
              className="aspect-video w-full bg-black"
              src={landscapeUrl}
              controls
              playsInline
              preload="metadata"
            />
          </div>
        </div>

        {verticalUrl ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">Vertical</p>
            <div className="mx-auto max-w-[280px] overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm">
              <video
                className="aspect-[9/16] w-full bg-black"
                src={verticalUrl}
                controls
                playsInline
                preload="metadata"
              />
            </div>
          </div>
        ) : null}

        {highlightsUrl ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">Pro highlights</p>
            <div className="overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm">
              <video
                className="aspect-video w-full bg-black"
                src={highlightsUrl}
                controls
                playsInline
                preload="metadata"
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-[16px] bg-neutral-50 p-4 shadow-sm">
          <p className="text-sm font-medium">Downloads</p>
          <div className="grid gap-2">
            <Button asChild className="h-11 rounded-[16px] text-sm">
              <a href={landscapeUrl} download target="_blank" rel="noreferrer">
                Landscape (watch)
              </a>
            </Button>
            {verticalUrl ? (
              <Button
                asChild
                variant="secondary"
                className="h-11 rounded-[16px] bg-white text-sm shadow-sm"
              >
                <a href={verticalUrl} download target="_blank" rel="noreferrer">
                  Vertical
                </a>
              </Button>
            ) : null}
            {storyUrl ? (
              <Button
                asChild
                variant="secondary"
                className="h-11 rounded-[16px] bg-white text-sm shadow-sm"
              >
                <a href={storyUrl} download target="_blank" rel="noreferrer">
                  Instagram / WhatsApp Story
                </a>
              </Button>
            ) : null}
            {tiktokUrl ? (
              <Button
                asChild
                variant="secondary"
                className="h-11 rounded-[16px] bg-white text-sm shadow-sm"
              >
                <a href={tiktokUrl} download target="_blank" rel="noreferrer">
                  TikTok-ready
                </a>
              </Button>
            ) : null}
            {highlightsUrl ? (
              <Button
                asChild
                variant="secondary"
                className="h-11 rounded-[16px] bg-white text-sm shadow-sm"
              >
                <a
                  href={highlightsUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                >
                  Highlights reel
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {recap.versions && recap.versions.length > 1 ? (
          <div className="rounded-[16px] bg-neutral-50 p-4 text-sm shadow-sm">
            <p className="font-medium">Version history</p>
            <ul className="mt-2 space-y-1 text-neutral-500">
              {[...recap.versions].reverse().map((v) => (
                <li key={v.generation}>
                  v{v.generation}
                  {v.mood ? ` · ${v.mood}` : ""} ·{" "}
                  {new Date(v.created_at).toLocaleString()}
                  {v.generation === recap.current_generation ? " · current" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <RemixPanel
          jobId={jobId}
          currentMood={job.recap_options?.mood || "joyful"}
        />

        <ShareControls jobId={jobId} initialShareUrl={initialShareUrl} />

        <div className="rounded-[16px] bg-neutral-50 p-4 text-sm text-neutral-600 shadow-sm">
          <p className="font-medium text-neutral-900">Commercial use</p>
          <p className="mt-2">
            You own your footage. The recap is licensed for personal and
            commercial publishing of <em>your</em> memories. Music beds follow
            their library licenses. Details in{" "}
            <Link href="/terms" className="text-green-700 underline">
              Terms
            </Link>
            .
          </p>
        </div>

        <Button
          asChild
          variant="ghost"
          className="h-12 rounded-[16px] text-base text-neutral-600"
        >
          <Link href="/upload">Create another</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-11 rounded-[16px] text-sm text-neutral-500"
        >
          <Link href="/support">Need help?</Link>
        </Button>
      </section>
    </main>
  );
}
