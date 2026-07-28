import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-8">
      <Logo />
      <section className="mt-16 space-y-4">
        <h1 className="text-2xl font-medium tracking-tight">Page not found</h1>
        <p className="text-neutral-500">
          This link may be wrong, expired, or private.
        </p>
        <Button asChild className="h-12 rounded-[16px]">
          <Link href="/">Back home</Link>
        </Button>
      </section>
    </main>
  );
}
