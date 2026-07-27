import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getJobForUser, getRecap } from "@/lib/jobs";
import { publicRecapUrl } from "@/lib/supabase/admin";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ jobId: string }> };

export default async function ResultPage({ params }: Props) {
  const user = await requireUser();
  const { jobId } = await params;
  const job = await getJobForUser(jobId, user.id);

  if (!job) notFound();
  if (job.status !== "completed") redirect(`/processing/${jobId}`);

  const recap = await getRecap(jobId);
  if (!recap?.landscape_path) {
    redirect(`/processing/${jobId}`);
  }

  const videoUrl = publicRecapUrl(recap.landscape_path);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header>
        <Logo />
      </header>

      <section className="mt-10 space-y-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Your recap</h1>
          <p className="mt-2 text-neutral-500">
            Ready to watch, download, or share.
          </p>
        </div>

        <div className="overflow-hidden rounded-[16px] bg-neutral-50 shadow-sm">
          <video
            className="aspect-video w-full bg-black"
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
          />
        </div>

        <div className="grid gap-3">
          <Button asChild className="h-12 rounded-[16px] text-base">
            <a href={videoUrl} download>
              Download
            </a>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-12 rounded-[16px] bg-neutral-50 text-base shadow-sm"
          >
            <Link href={`/share/${jobId}`}>Share</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-12 rounded-[16px] text-base text-neutral-600"
          >
            <Link href="/upload">Generate again</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
