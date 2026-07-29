export default function Loading() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col px-6 pb-16 pt-24">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-100" />
      <div className="mt-6 h-4 w-full animate-pulse rounded bg-neutral-100" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
      <div className="mt-10 h-40 animate-pulse rounded-[16px] bg-neutral-100" />
    </main>
  );
}
