import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="font-display text-[20px] font-semibold tracking-tight text-green-900"
    >
      {BRAND_NAME}
    </Link>
  );
}
