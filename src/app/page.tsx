import { auth } from "@/auth";
import { signInWithGoogle, signOutAction } from "@/app/actions/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="glow-orb pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[rgba(88,140,160,0.25)] blur-3xl"
      />
      <div
        aria-hidden
        className="glow-orb pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-[rgba(232,168,124,0.2)] blur-3xl"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight md:text-2xl">
          Memorys Recap
        </p>
        {session?.user ? (
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              تسجيل الخروج
            </button>
          </form>
        ) : (
          <Link
            href="/signin"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            دخول
          </Link>
        )}
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center px-6 pb-20 pt-10 md:px-10">
        <p className="animate-rise mb-4 text-sm font-medium tracking-[0.2em] text-[var(--accent)]">
          MEMORYS RECAP
        </p>
        <h1 className="animate-rise font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.15] md:text-6xl">
          ذكرياتك،
          <br />
          مرتبة وجاهزة.
        </h1>
        <p className="animate-rise-delay mt-5 max-w-md text-base leading-8 text-[var(--muted)] md:text-lg">
          ربط Google OAuth جاهز. سجّل دخولك ثم نبدأ بناء التطبيق.
        </p>

        <div className="animate-rise-delay mt-10 flex flex-wrap items-center gap-4">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center bg-[var(--foreground)] px-6 text-sm font-semibold text-[var(--background)] transition hover:opacity-90"
              >
                الدخول إلى لوحة التحكم
              </Link>
              <p className="text-sm text-[var(--muted)]">
                مرحباً، {session.user.name ?? session.user.email}
              </p>
            </>
          ) : (
            <form action={signInWithGoogle.bind(null, "/dashboard")}>
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-3 bg-[var(--foreground)] px-6 text-sm font-semibold text-[var(--background)] transition hover:opacity-90"
              >
                <GoogleMark />
                المتابعة مع Google
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l.1.1 6.2 5.2C39.2 37.1 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
