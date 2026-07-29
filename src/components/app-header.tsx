import Link from "next/link";
import { Logo } from "@/components/logo";
import { signOutAction } from "@/app/actions/auth";

export function AppHeader({
  active,
}: {
  active?: "upload" | "dashboard" | "billing" | "pricing";
}) {
  const linkClass = (key: typeof active) =>
    `min-h-11 px-2 text-sm ${
      active === key ? "font-medium text-neutral-900" : "text-neutral-500"
    }`;

  return (
    <header className="flex items-center justify-between gap-3">
      <Logo />
      <nav className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
        <Link href="/upload" className={linkClass("upload")}>
          Upload
        </Link>
        <Link href="/dashboard" className={linkClass("dashboard")}>
          Recaps
        </Link>
        <Link href="/billing" className={linkClass("billing")}>
          Credits
        </Link>
        <Link href="/support" className="min-h-11 px-2 text-sm text-neutral-500">
          Help
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="min-h-11 px-2 text-sm text-neutral-500">
            Out
          </button>
        </form>
      </nav>
    </header>
  );
}
