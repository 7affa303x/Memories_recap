import { requireUser } from "@/lib/session";
import { getBillingSummary } from "@/lib/billing/credits";
import { UploadWorkspace } from "@/components/upload-workspace";
import { AppHeader } from "@/components/app-header";
import { uploadCareLine, welcomeLine } from "@/lib/greeting";

export default async function UploadPage() {
  const user = await requireUser();
  const summary = await getBillingSummary(user.id, user.email);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <AppHeader active="upload" />

      <section className="mt-10">
        <p className="text-sm font-medium text-green-800">
          {welcomeLine({ name: user.name })}
        </p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">
          Upload memories
        </h1>
        <p className="mt-2 text-neutral-500">{uploadCareLine()}</p>
        <div className="mt-8">
          <UploadWorkspace initialBalance={summary.balance} />
        </div>
      </section>
    </main>
  );
}
