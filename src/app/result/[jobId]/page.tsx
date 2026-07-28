import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getJobForUser, getRecap } from "@/lib/jobs";
import { signedRecapUrl } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/billing/config";
import { Button } from "@/components/ui/button";
import { ShareControls } from "@/components/share-controls";
import { AppHeader } from "@/components/app-header";
import Link from "next/link";

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
  const initialShareUrl = job.share_token
    ? `${getAppUrl()}/s/${job.share_token}`
    : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader />

      <section className="mt-10 space-y-6">
        <div>
          <p className="text-sm font-medium text-green-700">Success</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">Your recap is ready</h1>
          <p className="mt-2 text-neutral-500">
            Landscape for watching. Vertical for stories.
          </p>
        </div>

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

        <div className="grid gap-3">
          <Button asChild className="h-12 rounded-[16px] text-base">
            <a href={landscapeUrl} download target="_blank" rel="noreferrer">
              Download landscape
            </a>
          </Button>
          {verticalUrl ? (
            <Button
              asChild
              variant="secondary"
              className="h-12 rounded-[16px] bg-neutral-50 text-base shadow-sm"
            >
              <a href={verticalUrl} download target="_blank" rel="noreferrer">
                Download vertical
              </a>
            </Button>
          ) : null}
        </div>

        <ShareControls jobId={jobId} initialShareUrl={initialShareUrl} />

        <Button
          asChild
          variant="ghost"
          className="h-12 rounded-[16px] text-base text-neutral-600"
        >
          <Link href="/upload">Create another</Link>
        </Button>
      </section>
    </main>
  );
}
