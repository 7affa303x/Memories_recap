import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getJobForUser, getRecap } from "@/lib/jobs";
import { publicRecapUrl } from "@/lib/supabase/admin";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ jobId: string }> };

export default async function SharePage({ params }: Props) {
  const user = await requireUser();
  const { jobId } = await params;
  const job = await getJobForUser(jobId, user.id);

  if (!job) notFound();
  if (job.status !== "completed") redirect(`/processing/${jobId}`);

  const recap = await getRecap(jobId, user.id);
  if (!recap?.landscape_path || !recap.vertical_path) {
    redirect(`/processing/${jobId}`);
  }

  const landscapeUrl = publicRecapUrl(recap.landscape_path);
  const verticalUrl = publicRecapUrl(recap.vertical_path);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href={`/result/${jobId}`} className="min-h-11 px-2 text-sm text-neutral-500">
          Back
        </Link>
      </header>

      <section className="mt-10 space-y-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Share</h1>
          <p className="mt-2 text-neutral-500">
            Landscape recap and vertical reel. Both downloadable.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-[16px] bg-neutral-50 p-4 shadow-sm">
            <p className="text-sm font-medium">Landscape recap</p>
            <video
              className="mt-3 aspect-video w-full rounded-[12px] bg-black"
              src={landscapeUrl}
              controls
              playsInline
              preload="metadata"
            />
            <Button asChild className="mt-4 h-12 w-full rounded-[16px] text-base">
              <a href={landscapeUrl} download>
                Download landscape
              </a>
            </Button>
          </div>

          <div className="rounded-[16px] bg-neutral-50 p-4 shadow-sm">
            <p className="text-sm font-medium">Vertical reel</p>
            <div className="mt-3 flex justify-center">
              <video
                className="aspect-[9/16] max-h-[420px] w-auto rounded-[12px] bg-black"
                src={verticalUrl}
                controls
                playsInline
                preload="metadata"
              />
            </div>
            <Button asChild className="mt-4 h-12 w-full rounded-[16px] text-base">
              <a href={verticalUrl} download>
                Download reel
              </a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
