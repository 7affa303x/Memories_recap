import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getJobForUser, getRecap, listUploads } from "@/lib/jobs";
import { signedRecapUrl } from "@/lib/supabase/admin";
import { signedSourcePreviewUrl } from "@/lib/source-download";
import { getAppUrl } from "@/lib/billing/config";
import { Button } from "@/components/ui/button";
import { ShareControls } from "@/components/share-controls";
import { AppHeader } from "@/components/app-header";
import { RemixPanel } from "@/components/remix-panel";
import {
  DeleteOriginalsButton,
  RecapRating,
  VersionRestoreButton,
} from "@/components/result-actions";
import { PreviewClipButton } from "@/components/preview-clip-button";
import Link from "next/link";
import { formatBytes } from "@/lib/types";
import { resultCareLine, welcomeLine } from "@/lib/greeting";
import { getBillingSummary } from "@/lib/billing/credits";
import { StreakBanner } from "@/components/streak-banner";

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
  const previewUrl = recap.preview_path
    ? await signedRecapUrl(recap.preview_path)
    : null;
  const initialShareUrl = job.share_token
    ? `${getAppUrl()}/s/${job.share_token}`
    : null;

  const uploads = await listUploads(jobId, user.id);
  const beforeThumbs: string[] = [];
  for (const upload of uploads.slice(0, 4)) {
    const url = await signedSourcePreviewUrl(upload.storage_path, 3600);
    if (url) beforeThumbs.push(url);
  }

  const expiresLabel = recap.expires_at
    ? new Date(recap.expires_at).toLocaleDateString()
    : null;

  let isPro = false;
  let streakCurrent = 0;
  let streakLongest = 0;
  try {
    const summary = await getBillingSummary(user.id, user.email);
    const status = summary.subscription?.status;
    isPro = status === "active" || status === "trialing";
    streakCurrent = summary.streakCurrent || 0;
    streakLongest = summary.streakLongest || 0;
  } catch {
    isPro = false;
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader />

      <section className="mt-8 space-y-6 animate-fade-up">
        <StreakBanner
          initialStreak={streakCurrent}
          initialLongest={streakLongest}
        />
        <div>
          <p className="text-sm font-medium text-green-700">
            {welcomeLine({ name: user.name })}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Your recap is ready
          </h1>
          <p className="mt-2 text-neutral-500">{resultCareLine()}</p>
          <p className="mt-1 text-sm text-neutral-400">
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

        <RecapRating jobId={jobId} initialRating={recap.rating} />

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
            <PreviewClipButton jobId={jobId} initialUrl={previewUrl} />
          </div>
        </div>

        {uploads.length > 0 ? (
          <DeleteOriginalsButton
            jobId={jobId}
            uploadIds={uploads.map((u) => u.id)}
          />
        ) : null}

        {recap.versions && recap.versions.length > 1 ? (
          <div className="rounded-[16px] bg-neutral-50 p-4 text-sm shadow-sm">
            <p className="font-medium">Version history</p>
            <ul className="mt-2 space-y-2 text-neutral-500">
              {[...recap.versions].reverse().map((v) => (
                <li
                  key={v.generation}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    v{v.generation}
                    {v.mood ? ` · ${v.mood}` : ""} ·{" "}
                    {new Date(v.created_at).toLocaleString()}
                    {v.generation === recap.current_generation
                      ? " · current"
                      : ""}
                  </span>
                  <VersionRestoreButton
                    jobId={jobId}
                    generation={v.generation}
                    isCurrent={v.generation === recap.current_generation}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <RemixPanel
          jobId={jobId}
          currentMood={job.recap_options?.mood || "joyful"}
          currentQuality={job.recap_options?.outputQuality || "fhd"}
          isPro={isPro}
        />

        <ShareControls jobId={jobId} initialShareUrl={initialShareUrl} />

        <p className="text-xs text-neutral-500">
          Music beds are for recap use under our library terms.
        </p>

        <div className="rounded-[16px] bg-green-50 p-4 text-sm text-green-950 shadow-sm">
          <p className="font-medium">Keep the warmth going</p>
          <p className="mt-2 text-green-900/80">
            Share with family, rate how it felt, or invite a friend — earn more
            Moments without the hard sell.
          </p>
          <Link
            href="/moments"
            className="mt-3 inline-block text-green-800 underline"
          >
            See ways to earn Moments
          </Link>
        </div>

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
          <Link href="/account">Account</Link>
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
