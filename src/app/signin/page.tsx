import { auth } from "@/auth";
import { signInWithGoogle } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/dashboard";

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md animate-rise">
        <Link
          href="/"
          className="mb-10 inline-block font-[family-name:var(--font-display)] text-2xl font-bold"
        >
          Memorys Recap
        </Link>

        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
          تسجيل الدخول
        </h1>
        <p className="mt-3 text-[var(--muted)] leading-7">
          استخدم حساب Google المرتبط بمشروعك في Google Cloud.
        </p>

        {params.error ? (
          <p
            role="alert"
            className="mt-6 border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            فشل تسجيل الدخول ({params.error}). تأكد من إعداد Redirect URI في
            Google Cloud.
          </p>
        ) : null}

        <form action={signInWithGoogle.bind(null, callbackUrl)} className="mt-8">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-3 bg-[var(--foreground)] text-sm font-semibold text-[var(--background)] transition hover:opacity-90"
          >
            المتابعة مع Google
          </button>
        </form>

        <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
          Redirect URI المطلوب:
          <br />
          <code className="text-[var(--accent)]" dir="ltr">
            http://localhost:3000/api/auth/callback/google
          </code>
        </p>
      </div>
    </main>
  );
}
