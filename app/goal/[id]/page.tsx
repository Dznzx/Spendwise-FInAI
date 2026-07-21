import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function SharedGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!item) notFound();

  const pct = Math.min(100, Math.round((item.savedAmount / item.price) * 100));

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center font-display font-extrabold text-white text-lg">
            S
          </div>
          <span className="font-display text-xl font-bold text-[var(--white)]">
            SpendWise
          </span>
        </div>

        <p className="text-xs uppercase tracking-wide text-[var(--muted2)] font-medium mb-2">
          Saving for
        </p>
        <h1 className="font-display text-3xl font-bold text-[var(--white)] mb-8">
          {item.name}
        </h1>

        <div className="relative w-40 h-40 mx-auto mb-6">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="url(#grad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 276} 276`}
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--blue)" />
                <stop offset="1" stopColor="var(--purple)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-3xl font-bold text-[var(--white)]">{pct}%</span>
          </div>
        </div>

        <p className="text-sm text-[var(--muted2)]">
          {item.achieved ? "🎉 Goal achieved!" : "Still saving — check back soon."}
        </p>
      </div>
    </main>
  );
}
