import { requireUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { UploadWorkspace } from "@/components/upload-workspace";
import { signOutAction } from "@/app/actions/auth";

export default async function UploadPage() {
  await requireUser();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <form action={signOutAction}>
          <button type="submit" className="min-h-11 px-2 text-sm text-neutral-500">
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-10">
        <h1 className="text-2xl font-medium tracking-tight">Upload memories</h1>
        <p className="mt-2 text-neutral-500">
          Your originals stay untouched. We only create a new recap.
        </p>
        <div className="mt-8">
          <UploadWorkspace />
        </div>
      </section>
    </main>
  );
}
