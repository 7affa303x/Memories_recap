import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getBillingSummary } from "@/lib/billing/credits";
import { Logo } from "@/components/logo";
import { UploadWorkspace } from "@/components/upload-workspace";
import { signOutAction } from "@/app/actions/auth";

export default async function UploadPage() {
  const user = await requireUser();
  const summary = await getBillingSummary(user.id, user.email);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="min-h-11 px-2 text-sm text-neutral-500">
            Dashboard
          </Link>
          <Link href="/billing" className="min-h-11 px-2 text-sm text-neutral-500">
            Billing
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="min-h-11 px-2 text-sm text-neutral-500">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mt-10">
        <h1 className="text-2xl font-medium tracking-tight">Upload memories</h1>
        <p className="mt-2 text-neutral-500">
          Upload → we pick the best moments → you get landscape + vertical.
          Originals stay untouched.
        </p>
        <div className="mt-8">
          <UploadWorkspace initialBalance={summary.balance} />
        </div>
      </section>
    </main>
  );
}
