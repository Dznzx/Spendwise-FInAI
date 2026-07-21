import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--bg)] text-center">
      <div className="max-w-md">
        <div className="inline-flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center font-display font-extrabold text-white text-lg">
            S
          </div>
          <span className="font-display text-xl font-bold text-[var(--white)]">
            SpendWise
          </span>
        </div>

        <p className="text-xs uppercase tracking-wide text-[var(--blue)] font-semibold mb-4">
          By Veltron Group
        </p>

        <h1 className="font-display text-4xl font-extrabold text-[var(--white)] leading-tight mb-4">
          See the trade-off<br />before you spend.
        </h1>
        <p className="text-[var(--muted2)] mb-10 leading-relaxed">
          Tell SpendWise what you&apos;re saving for. Before your next
          impulse buy, it shows you exactly what it costs you — in plain
          terms, no guilt trip.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-full bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white font-medium px-6 py-3 hover:opacity-90 transition"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--border2)] text-[var(--white)] font-medium px-6 py-3 hover:bg-white/5 transition"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
