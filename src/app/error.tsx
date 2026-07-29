"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-24">
      <h1 className="text-2xl font-medium tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-neutral-500">
        Please try again. If it keeps happening, return home and start from your
        dashboard.
      </p>
      <div className="mt-8 grid gap-3">
        <Button className="h-12 rounded-[16px]" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="secondary" className="h-12 rounded-[16px]">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
