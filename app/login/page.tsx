"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center font-display font-extrabold text-white text-lg">
              S
            </div>
            <span className="font-display text-xl font-bold text-[var(--white)]">
              SpendWise
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--white)]">
            Welcome back
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--s1)] rounded-2xl p-7 border border-[var(--border2)]"
        >
          {error && (
            <div className="mb-4 text-sm bg-[var(--red)]/15 border border-[var(--red)]/30 text-[var(--red)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-4 rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            placeholder="you@email.com"
          />

          <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-5 rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            placeholder="Your password"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white font-medium py-2.5 hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--muted2)] mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[var(--blue)] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
