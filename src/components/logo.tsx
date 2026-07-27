import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="text-[18px] font-medium tracking-tight text-neutral-900"
    >
      Memory Recap
    </Link>
  );
}
