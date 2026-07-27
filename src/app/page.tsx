import { getOptionalUser } from "@/lib/session";
import { signOutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const user = await getOptionalUser();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/upload";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Logo />
        {user ? (
          <form action={signOutAction}>
            <button
              type="submit"
              className="min-h-11 px-2 text-sm text-neutral-500"
            >
              Sign out
            </button>
          </form>
        ) : null}
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <h1 className="text-[32px] font-medium leading-10 tracking-tight text-neutral-900">
          Turn heavy memories into watchable moments.
        </h1>
        <p className="mt-4 text-base text-neutral-500">
          Upload your videos. We turn them into one calm recap.
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

        <ul className="mt-8 space-y-3 text-sm text-neutral-500">
          <li>Original videos stay untouched</li>
          <li>Private by default</li>
          <li>Pay only for processed size</li>
        </ul>
      </section>
    </main>
  );
}
