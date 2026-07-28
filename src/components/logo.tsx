import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="font-display text-[20px] font-semibold tracking-tight text-green-900"
    >
      Memory Recap
    </Link>
  );
}
