import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { signOutAction } from "@/app/actions/auth";
import { getOptionalUser } from "@/lib/session";

export async function AppHeader({
  active,
}: {
  active?: "upload" | "dashboard" | "billing" | "pricing" | "account";
}) {
  const user = await getOptionalUser();
  const linkClass = (key: typeof active) =>
    `min-h-11 px-2 text-sm ${
      active === key ? "font-medium text-neutral-900" : "text-neutral-500"
    }`;

  const navLinks = (
    <>
      <Link href="/upload" className={linkClass("upload")}>
        Upload
      </Link>
      <Link href="/dashboard" className={linkClass("dashboard")}>
        Recaps
      </Link>
      <Link href="/billing" className={linkClass("billing")}>
        Moments
      </Link>
      <Link href="/moments" className="min-h-11 px-2 text-sm text-neutral-500">
        Earn
      </Link>
      <Link href="/account" className={linkClass("account")}>
        Account
      </Link>
      <Link href="/support" className="min-h-11 px-2 text-sm text-neutral-500">
        Help
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="min-h-11 px-2 text-sm text-neutral-500">
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <header className="flex items-center justify-between gap-3">
      {user ? (
        <div className="flex min-w-0 items-center gap-3">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || "Google account"}
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-neutral-200"
              unoptimized
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-900"
              aria-hidden
            >
              {(user.name || user.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900">
              {user.name || "Your account"}
            </p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
          </div>
        </div>
      ) : (
        <Logo />
      )}
      <nav className="hidden items-center justify-end gap-x-1 sm:flex">
        {navLinks}
      </nav>
      <details className="relative sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl bg-neutral-100 px-3 text-sm font-medium text-neutral-800 marker:content-none [&::-webkit-details-marker]:hidden">
          Menu
        </summary>
        <nav className="absolute right-0 z-40 mt-2 flex min-w-[10.5rem] flex-col rounded-[16px] bg-white py-2 shadow-md ring-1 ring-neutral-200">
          {navLinks}
        </nav>
      </details>
    </header>
  );
}
