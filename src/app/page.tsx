import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata: Metadata = {
  title: "Memory Recap — Turn heavy videos into watchable moments",
  description:
    "Upload memory videos. Pay for processed size. Get a calm landscape + vertical recap ready to watch and share.",
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const user = await getOptionalUser();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/upload";

  return (
    <main className="min-h-full bg-[radial-gradient(1000px_520px_at_50%_-8%,#dcfce7,transparent),linear-gradient(180deg,#f8faf9_0%,#ffffff_42%,#f0fdf4_100%)]">
      <div className="mx-auto flex w-full max-w-lg flex-col px-6 pb-20 pt-8">
        <header className="flex items-center justify-between">
          <span className="sr-only">Memory Recap</span>
          <div className="flex items-center gap-2">
            <a href="/pricing" className="min-h-11 px-2 text-sm text-neutral-500">
              Pricing
            </a>
            {user ? (
              <>
                <a href="/dashboard" className="min-h-11 px-2 text-sm text-neutral-500">
                  Dashboard
                </a>
                <form action={signOutAction}>
                  <button type="submit" className="min-h-11 px-2 text-sm text-neutral-500">
                    Sign out
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </header>

        <section className="pt-10">
          <h1 className="font-display text-[42px] font-semibold leading-[1.05] tracking-tight text-green-900 sm:text-[48px]">
            Memory Recap
          </h1>
          <p className="mt-5 text-[22px] font-medium leading-snug tracking-tight text-neutral-900">
            Turn heavy memories into watchable moments.
          </p>
          <p className="mt-4 text-base text-neutral-500">
            Upload the long videos. We pick the best moments and deliver one
            calm recap — landscape to watch, vertical to share.
          </p>

          {params.error ? (
            <p className="mt-6 rounded-[16px] bg-red-50 px-4 py-3 text-sm text-red-700">
              Sign in failed. Clear cookies for this site, then try again.
            </p>
          ) : null}

          <div className="mt-10">
            {user ? (
              <Button asChild className="h-12 w-full rounded-[16px] text-base">
                <a href="/upload">Upload memories</a>
              </Button>
            ) : (
              <GoogleSignInButton callbackUrl={callbackUrl} />
            )}
          </div>

          <ol className="mt-8 grid gap-3 text-sm text-neutral-600">
            <li className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              1. Upload your videos
            </li>
            <li className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              2. Confirm cost, then pay with credits
            </li>
            <li className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              3. Wait while we build the recap
            </li>
            <li className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              4. Watch, download, and share
            </li>
          </ol>
        </section>

        <section className="mt-16 space-y-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
            Who is this for?
          </h2>
          <ul className="space-y-3 text-sm text-neutral-600">
            <li className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              Families with hours of phone videos from a trip or celebration
            </li>
            <li className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              Anyone who wants a shareable vertical cut without editing
            </li>
            <li className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              People who want originals left untouched and private by default
            </li>
          </ul>
        </section>

        <section className="mt-16 space-y-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
            How it feels
          </h2>
          <div className="overflow-hidden rounded-[20px] border border-green-100 bg-neutral-900 shadow-sm">
            <div className="aspect-video bg-[linear-gradient(135deg,#14532d_0%,#052e16_55%,#166534_100%)] p-6 text-white">
              <p className="text-sm text-green-100/90">Demo preview</p>
              <p className="mt-8 font-display text-3xl font-semibold leading-snug">
                From messy camera rolls → one calm story.
              </p>
              <p className="mt-4 max-w-sm text-sm text-green-50/90">
                Smart moment selection keeps order, skips black/shaky fluff, and
                exports landscape + vertical automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 space-y-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">
            FAQ
          </h2>
          <div className="space-y-3 text-sm text-neutral-600">
            <details className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              <summary className="cursor-pointer font-medium text-neutral-900">
                Do you delete my originals?
              </summary>
              <p className="mt-2">
                No. Originals stay untouched. We only create new recap files.
              </p>
            </details>
            <details className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              <summary className="cursor-pointer font-medium text-neutral-900">
                How does pricing work?
              </summary>
              <p className="mt-2">
                You pay in credits based on processed size (about 1 credit per
                MB, minimum 10). Failed system jobs restore credits.
              </p>
            </details>
            <details className="rounded-[16px] bg-white/80 px-4 py-3 shadow-sm">
              <summary className="cursor-pointer font-medium text-neutral-900">
                Can I share the result?
              </summary>
              <p className="mt-2">
                Yes. Create a public link with optional password and expiry.
              </p>
            </details>
          </div>
        </section>

        <section className="mt-16">
          {user ? (
            <Button asChild className="h-12 w-full rounded-[16px] text-base">
              <a href="/upload">Start a recap</a>
            </Button>
          ) : (
            <GoogleSignInButton callbackUrl={callbackUrl} label="Continue with Google" />
          )}
          <p className="mt-4 text-center text-xs text-neutral-400">
            <a href="/privacy" className="underline">
              Privacy
            </a>{" "}
            ·{" "}
            <a href="/terms" className="underline">
              Terms
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
