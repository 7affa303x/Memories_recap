import { requireUser } from "@/lib/session";
import { getJobForUser } from "@/lib/jobs";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ProcessingTracker } from "@/components/processing-tracker";

type Props = { params: Promise<{ jobId: string }> };

export default async function ProcessingPage({ params }: Props) {
  const user = await requireUser();
  const { jobId } = await params;
  const job = await getJobForUser(jobId, user.id);

  if (!job) notFound();
  if (job.status === "completed") redirect(`/result/${jobId}`);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header>
        <Logo />
      </header>
      <ProcessingTracker jobId={jobId} />
    </main>
  );
}
