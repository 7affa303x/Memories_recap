import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function Logo({
  href = "/",
  showMark = true,
}: {
  href?: string;
  showMark?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 font-display text-[20px] font-semibold tracking-tight text-green-900"
    >
      {showMark ? (
        <Image
          src="/brand/logo-mark.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-md object-contain"
          priority
        />
      ) : null}
      <span>{BRAND_NAME}</span>
    </Link>
  );
}
