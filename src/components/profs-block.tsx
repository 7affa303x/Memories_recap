import { PROFS_ENABLED } from "@/lib/flags";
import { PROFS } from "@/lib/profs";

/** Hidden by default — enable with PROFS_ENABLED=true */
export function ProfsBlock() {
  if (!PROFS_ENABLED) return null;

  return (
    <section className="space-y-4 rounded-[16px] bg-neutral-50 p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-neutral-800">From professionals</p>
        <p className="mt-1 text-sm text-neutral-500">
          Quiet notes from people who work with memory every day.
        </p>
      </div>
      <ul className="space-y-4">
        {PROFS.map((p) => (
          <li key={p.id} className="border-t border-neutral-200 pt-4 first:border-0 first:pt-0">
            <p className="text-sm text-neutral-800">&ldquo;{p.quote}&rdquo;</p>
            <p className="mt-2 text-sm font-medium text-neutral-900">{p.name}</p>
            <p className="text-xs text-neutral-500">
              {p.title} · {p.focus}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
