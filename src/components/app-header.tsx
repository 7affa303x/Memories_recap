import Link from "next/link";
import { Logo } from "@/components/logo";
import { signOutAction } from "@/app/actions/auth";

export function AppHeader({
  active,
}: {
  active?: "upload" | "dashboard" | "billing" | "pricing" | "account";
}) {
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
        Credits
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
      <Logo />
      {/* Desktop: full nav */}
      <nav className="hidden items-center justify-end gap-x-1 sm:flex">
        {navLinks}
      </nav>
      {/* Mobile: compact menu */}
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
