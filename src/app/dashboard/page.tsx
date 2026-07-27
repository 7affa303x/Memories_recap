import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin?callbackUrl=/dashboard");
  }

  const { user } = session;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12 md:px-10">
      <div className="animate-rise flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl font-bold"
        >
          Memorys Recap
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            تسجيل الخروج
          </button>
        </form>
      </div>

      <section className="animate-rise-delay mt-14 border-t border-[var(--line)] pt-10">
        <p className="text-sm font-medium tracking-[0.18em] text-[var(--accent)]">
          GOOGLE OAUTH
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold">
          تم الربط بنجاح
        </h1>
        <p className="mt-3 max-w-md text-[var(--muted)] leading-7">
          حساب Google متصل. يمكنك الآن البدء ببناء ميزات التطبيق فوق هذه الجلسة.
        </p>

        <div className="mt-8 flex items-center gap-4">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "صورة الحساب"}
              width={56}
              height={56}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface)] text-lg font-semibold">
              {(user.name ?? user.email ?? "?").slice(0, 1)}
            </div>
          )}
          <div>
            <p className="font-semibold">{user.name ?? "مستخدم Google"}</p>
            <p className="text-sm text-[var(--muted)]" dir="ltr">
              {user.email}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
