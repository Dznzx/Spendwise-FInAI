"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type WishlistItem = {
  id: string;
  name: string;
  price: number;
  priority: number;
  savedAmount: number;
  achieved: boolean;
};

type Purchase = {
  id: string;
  description: string;
  amount: number;
  category: string;
  aiSummary: string | null;
  decision: string;
  createdAt: string;
  wishlistItem: { name: string } | null;
  additionalGoalNames: string[];
};

type Stats = {
  totalSaved: number;
  totalSpent: number;
  skipCount: number;
  spendCount: number;
  currentStreak: number;
  categoryBreakdown: { category: string; amount: number; limit: number | null }[];
  monthLabel: string;
};

type Budget = { id: string; category: string; monthlyLimit: number };

const PRIORITY_LABEL: Record<number, string> = { 1: "LOW", 2: "MED", 3: "HIGH" };
const CATEGORIES = ["food", "shopping", "entertainment", "transport", "bills", "subscriptions", "miscellaneous"];

function money(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [priority, setPriority] = useState(1);
  const [savedAmount, setSavedAmount] = useState("");

  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [pDescription, setPDescription] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pGoalIds, setPGoalIds] = useState<string[]>([]);
  const [pCategory, setPCategory] = useState("miscellaneous");
  const [stats, setStats] = useState<Stats | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("food");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("miscellaneous");
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [wifAmount, setWifAmount] = useState("");
  const [wifFrequency, setWifFrequency] = useState<"weekly" | "monthly">("weekly");
  const [wifWeeks, setWifWeeks] = useState("4");
  const [pLoading, setPLoading] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<Purchase | null>(null);

  const loadAll = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if (!meData.user) {
      router.push("/login");
      return;
    }
    setUserName(meData.user.name);

    const [wlRes, pRes, sRes, bRes] = await Promise.all([
      fetch("/api/wishlist"),
      fetch("/api/purchases"),
      fetch("/api/stats"),
      fetch("/api/budgets"),
    ]);
    const wlData = await wlRes.json();
    const pData = await pRes.json();
    const sData = await sRes.json();
    const bData = await bRes.json();
    setItems(wlData.items ?? []);
    setPurchases(pData.purchases ?? []);
    setStats(sData);
    setBudgets(bData.budgets ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) return;
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        price: Number(price),
        priority,
        savedAmount: Number(savedAmount || 0),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => [data.item, ...prev]);
      setName("");
      setPrice("");
      setSavedAmount("");
      setPriority(1);
      setShowForm(false);
    }
  }

  async function handleLogPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!pDescription || !pAmount) return;
    setPLoading(true);
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: pDescription,
        amount: Number(pAmount),
        wishlistItemId: pGoalIds[0] || null,
        additionalGoalIds: pGoalIds.slice(1),
        category: pCategory,
      }),
    });
    setPLoading(false);
    if (res.ok) {
      const data = await res.json();
      setPendingPurchase(data.purchase);
      setPurchases((prev) => [data.purchase, ...prev]);
    }
  }

  async function handleDecision(id: string, decision: "proceeded" | "cancelled") {
    const res = await fetch(`/api/purchases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, decision } : p)));
      if (pendingPurchase?.id === id) {
        setPendingPurchase(null);
        setShowPurchaseForm(false);
        setPDescription("");
        setPAmount("");
        setPGoalIds([]);
        setPCategory("miscellaneous");
      }
      // Skipping moves money into the linked goal, and stats change either way — refresh both.
      const [wlRes, sRes] = await Promise.all([fetch("/api/wishlist"), fetch("/api/stats")]);
      setItems((await wlRes.json()).items ?? []);
      setStats(await sRes.json());
    }
  }

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!budgetLimit) return;
    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: budgetCategory, monthlyLimit: Number(budgetLimit) }),
    });
    if (res.ok) {
      const data = await res.json();
      setBudgets((prev) => {
        const rest = prev.filter((b) => b.category !== data.budget.category);
        return [...rest, data.budget];
      });
      const sRes = await fetch("/api/stats");
      setStats(await sRes.json());
      setBudgetLimit("");
    }
  }

  async function handleAddFunds(item: WishlistItem, amount: number) {
    const res = await fetch(`/api/wishlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedAmount: item.savedAmount + amount }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
    }
  }

  async function handleEditGoal(item: WishlistItem, name: string, price: number, priority: number) {
    const res = await fetch(`/api/wishlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price, priority }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
    }
  }

  async function handleEditPurchase(id: string) {
    const res = await fetch(`/api/purchases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editDescription,
        amount: Number(editAmount),
        category: editCategory,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.purchase } : p)));
      setEditingPurchaseId(null);
    }
  }

  function startEditPurchase(p: Purchase) {
    setEditingPurchaseId(p.id);
    setEditDescription(p.description);
    setEditAmount(p.amount.toString());
    setEditCategory(p.category);
  }

  async function toggleAchieved(item: WishlistItem) {
    const res = await fetch(`/api/wishlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achieved: !item.achieved }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, achieved: !i.achieved } : i))
      );
    }
  }

  async function deleteItem(id: string) {
    const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="text-[var(--muted2)] font-mono text-sm">Loading your dashboard...</p>
      </main>
    );
  }

  const active = items.filter((i) => !i.achieved);
  const achieved = items.filter((i) => i.achieved);

  // A purchase description counts as "recurring" if it shows up 3+ times
  // (case-insensitive, trimmed) anywhere in the history.
  const descriptionCounts: Record<string, number> = {};
  for (const p of purchases) {
    const key = p.description.trim().toLowerCase();
    descriptionCounts[key] = (descriptionCounts[key] || 0) + 1;
  }
  const isRecurring = (p: Purchase) => descriptionCounts[p.description.trim().toLowerCase()] >= 3;

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      !searchQuery || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center font-display font-extrabold text-white">
              S
            </div>
            <span className="font-display text-lg font-bold text-[var(--white)]">
              SpendWise
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--muted2)]">Hi, {userName}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-[var(--muted2)] hover:text-[var(--white)] transition"
            >
              Log out
            </button>
          </div>
        </div>

        {stats && (stats.skipCount > 0 || stats.spendCount > 0) && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-wide text-[var(--muted2)] font-medium mb-3">
              {stats.monthLabel}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--s1)] rounded-xl p-4 border border-[var(--border2)]">
                <p className="text-xs uppercase tracking-wide text-[var(--muted2)] mb-1">Saved by skipping</p>
                <p className="font-mono text-lg font-semibold text-[var(--green)]">{money(stats.totalSaved)}</p>
              </div>
              <div className="bg-[var(--s1)] rounded-xl p-4 border border-[var(--border2)]">
                <p className="text-xs uppercase tracking-wide text-[var(--muted2)] mb-1">Spent anyway</p>
                <p className="font-mono text-lg font-semibold text-[var(--red)]">{money(stats.totalSpent)}</p>
              </div>
              <div className="bg-[var(--s1)] rounded-xl p-4 border border-[var(--border2)]">
                <p className="text-xs uppercase tracking-wide text-[var(--muted2)] mb-1">Current streak</p>
                <p className="font-mono text-lg font-semibold text-[var(--cyan)]">
                  {stats.currentStreak} {stats.currentStreak === 1 ? "skip" : "skips"}
                </p>
              </div>
            </div>
          </div>
        )}

        {stats && stats.categoryBreakdown.some((c) => c.amount > 0 || c.limit) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted2)] font-medium">
                Spending by category
              </p>
              <button
                onClick={() => setShowBudgetForm((s) => !s)}
                className="text-xs text-[var(--blue)] hover:underline"
              >
                {showBudgetForm ? "Close" : "Set a budget"}
              </button>
            </div>

            {showBudgetForm && (
              <form
                onSubmit={handleSetBudget}
                className="bg-[var(--s1)] rounded-xl p-4 border border-[var(--blue)]/40 mb-3 flex gap-2 items-end"
              >
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Category
                  </label>
                  <select
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Monthly limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                    placeholder="5000"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition"
                >
                  Save
                </button>
              </form>
            )}

            <div className="bg-[var(--s1)] rounded-xl p-4 border border-[var(--border2)] space-y-3">
              {stats.categoryBreakdown
                .filter((c) => c.amount > 0 || c.limit)
                .map((c) => {
                  const overBudget = c.limit !== null && c.amount > c.limit;
                  const pct = c.limit
                    ? Math.min(100, Math.round((c.amount / c.limit) * 100))
                    : Math.round((c.amount / (stats.totalSpent || 1)) * 100);
                  return (
                    <div key={c.category}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm text-[var(--white)]/80 capitalize w-28 flex-shrink-0">
                          {c.category}
                        </span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              overBudget
                                ? "bg-[var(--red)]"
                                : "bg-gradient-to-r from-[var(--blue)] to-[var(--purple)]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono text-xs w-28 text-right flex-shrink-0 ${
                            overBudget ? "text-[var(--red)]" : "text-[var(--muted2)]"
                          }`}
                        >
                          {money(c.amount)}
                          {c.limit ? ` / ${money(c.limit)}` : ""}
                        </span>
                      </div>
                      {overBudget && (
                        <p className="text-xs text-[var(--red)] pl-[7.5rem]">
                          Over budget by {money(c.amount - (c.limit ?? 0))}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="mb-8">
          <button
            onClick={() => setShowWhatIf((s) => !s)}
            className="text-xs text-[var(--purple)] hover:underline"
          >
            {showWhatIf ? "Close simulator" : "What if I skip this regularly? →"}
          </button>
          {showWhatIf && (
            <div className="mt-3 bg-[var(--s1)] rounded-xl p-4 border border-[var(--purple)]/40">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={wifAmount}
                    onChange={(e) => setWifAmount(e.target.value)}
                    placeholder="500"
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--purple)]"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Every
                  </label>
                  <select
                    value={wifFrequency}
                    onChange={(e) => setWifFrequency(e.target.value as "weekly" | "monthly")}
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--purple)]"
                  >
                    <option value="weekly">Week</option>
                    <option value="monthly">Month</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    For how many weeks
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={wifWeeks}
                    onChange={(e) => setWifWeeks(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--purple)]"
                  />
                </div>
              </div>
              {wifAmount && Number(wifWeeks) > 0 && (
                <p className="text-sm text-[var(--white)]/90 font-display">
                  {(() => {
                    const weeks = Number(wifWeeks);
                    const occurrences = wifFrequency === "weekly" ? weeks : Math.max(1, Math.floor(weeks / 4));
                    const total = Number(wifAmount) * occurrences;
                    return (
                      <>
                        Skipping that <span className="text-[var(--purple)] font-semibold">{occurrences}</span>{" "}
                        time{occurrences === 1 ? "" : "s"} over {weeks} weeks saves{" "}
                        <span className="text-[var(--green)] font-semibold">{money(total)}</span>.
                      </>
                    );
                  })()}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mb-10">
          {!showPurchaseForm && !pendingPurchase && (
            <button
              onClick={() => setShowPurchaseForm(true)}
              className="w-full rounded-2xl border-2 border-dashed border-[var(--border2)] py-6 text-center hover:border-[var(--blue)]/60 transition"
            >
              <span className="font-display text-lg text-[var(--white)]">
                About to spend on something?
              </span>
              <br />
              <span className="text-sm text-[var(--muted2)]">
                Tell SpendWise before you buy — see the trade-off first.
              </span>
            </button>
          )}

          {showPurchaseForm && !pendingPurchase && (
            <form
              onSubmit={handleLogPurchase}
              className="bg-[var(--s1)] rounded-2xl p-6 border border-[var(--blue)]/40"
            >
              <p className="font-display text-lg text-[var(--white)] mb-4">
                What are you about to buy?
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Description
                  </label>
                  <input
                    value={pDescription}
                    onChange={(e) => setPDescription(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                    placeholder="e.g. Weekend dinner out"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pAmount}
                    onChange={(e) => setPAmount(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] font-mono placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                    placeholder="1500"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Weigh against {pGoalIds.length > 1 && `(splits evenly across ${pGoalIds.length})`}
                  </label>
                  {active.length === 0 ? (
                    <p className="text-sm text-[var(--muted2)]">No active goals yet — add one below.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {active.map((i) => {
                        const selected = pGoalIds.includes(i.id);
                        return (
                          <button
                            type="button"
                            key={i.id}
                            onClick={() =>
                              setPGoalIds((prev) =>
                                selected ? prev.filter((id) => id !== i.id) : [...prev, i.id]
                              )
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                              selected
                                ? "bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white border-transparent"
                                : "bg-transparent text-[var(--muted2)] border-[var(--border2)]"
                            }`}
                          >
                            {i.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                    Category
                  </label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pLoading}
                  className="flex-1 rounded-lg bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white font-medium py-2.5 hover:opacity-90 transition disabled:opacity-50"
                >
                  {pLoading ? "Thinking..." : "Show me the trade-off"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPurchaseForm(false)}
                  className="rounded-lg border border-[var(--border2)] text-[var(--muted2)] px-4 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {pendingPurchase && (
            <div className="bg-[var(--s1)] rounded-2xl p-6 border border-[var(--blue)]/40">
              <p className="text-xs uppercase tracking-wide text-[var(--muted2)] font-medium mb-2">
                {money(pendingPurchase.amount)} · {pendingPurchase.description}
              </p>
              <p className="font-display text-lg text-[var(--white)] leading-snug mb-5">
                {pendingPurchase.aiSummary}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecision(pendingPurchase.id, "proceeded")}
                  className="flex-1 rounded-lg bg-[var(--red)]/15 border border-[var(--red)]/30 text-[var(--red)] font-medium py-2.5 hover:bg-[var(--red)]/25 transition"
                >
                  Buy it anyway
                </button>
                <button
                  onClick={() => handleDecision(pendingPurchase.id, "cancelled")}
                  className="flex-1 rounded-lg bg-[var(--green)]/15 border border-[var(--green)]/30 text-[var(--green)] font-medium py-2.5 hover:bg-[var(--green)]/25 transition"
                >
                  Skip it, save instead
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-2xl font-bold text-[var(--white)]">
            Your goals
          </h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition"
          >
            {showForm ? "Cancel" : "+ Add goal"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="bg-[var(--s1)] rounded-2xl p-6 mb-6 border border-[var(--border2)]"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                  What are you saving for?
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                  placeholder="e.g. Headphones"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                  Target price
                </label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] font-mono placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                  placeholder="15000"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                  Already saved
                </label>
                <input
                  type="number"
                  min="0"
                  value={savedAmount}
                  onChange={(e) => setSavedAmount(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2.5 text-[var(--white)] font-mono placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                  placeholder="0"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs uppercase tracking-wide text-[var(--muted2)] mb-1.5 font-medium">
                  Priority
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition ${
                        priority === p
                          ? "bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white border-transparent"
                          : "bg-transparent text-[var(--muted2)] border-[var(--border2)]"
                      }`}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white font-medium py-2.5 hover:opacity-90 transition"
            >
              Add goal
            </button>
          </form>
        )}

        {items.length === 0 && !showForm && (
          <div className="bg-white/[0.02] border border-[var(--border)] rounded-2xl p-10 text-center">
            <p className="font-display text-lg text-[var(--white)]/80 mb-1">
              No goals yet.
            </p>
            <p className="text-sm text-[var(--muted2)]">
              Add something you&apos;re saving for — that&apos;s what SpendWise will
              weigh your spending against.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {active.map((item) => (
            <GoalRow
              key={item.id}
              item={item}
              onToggle={() => toggleAchieved(item)}
              onDelete={() => deleteItem(item.id)}
              onAddFunds={(amount) => handleAddFunds(item, amount)}
              onEdit={(name, price, priority) => handleEditGoal(item, name, price, priority)}
            />
          ))}
        </div>

        {achieved.length > 0 && (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-wide text-[var(--muted2)] font-medium mb-3">
              Achieved
            </p>
            <div className="space-y-3">
              {achieved.map((item) => (
                <GoalRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggleAchieved(item)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {purchases.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <p className="text-xs uppercase tracking-wide text-[var(--muted2)] font-medium">
                Recent decisions
              </p>
              <a
                href="/api/export"
                className="text-xs text-[var(--blue)] hover:underline"
              >
                Export CSV ↓
              </a>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] capitalize"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {filteredPurchases.length === 0 && (
                <p className="text-sm text-[var(--muted2)] px-1">No matches.</p>
              )}
              {filteredPurchases.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 rounded-lg bg-white/[0.02] border border-[var(--border)]"
                >
                  {editingPurchaseId === p.id ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="flex-1 min-w-[140px] rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-2 py-1.5 text-sm text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                      />
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-24 rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-2 py-1.5 text-sm text-[var(--white)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-2 py-1.5 text-sm text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] capitalize"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleEditPurchase(p.id)}
                        className="rounded-lg bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white text-xs font-medium px-3 py-1.5 hover:opacity-90 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPurchaseId(null)}
                        className="text-xs text-[var(--muted2)] hover:text-[var(--white)] px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--white)]/80 truncate">
                          {p.description}
                          {isRecurring(p) && (
                            <span className="ml-2 text-xs font-mono px-1.5 py-0.5 rounded-full bg-[var(--purple)]/15 text-[var(--purple)]">
                              recurring
                            </span>
                          )}
                          {(p.wishlistItem || p.additionalGoalNames.length > 0) && (
                            <span className="text-[var(--muted2)]">
                              {" "}
                              · vs{" "}
                              {[p.wishlistItem?.name, ...p.additionalGoalNames]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono text-sm text-[var(--muted2)]">
                          {money(p.amount)}
                        </span>
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                            p.decision === "proceeded"
                              ? "bg-[var(--red)]/15 text-[var(--red)]"
                              : p.decision === "cancelled"
                              ? "bg-[var(--green)]/15 text-[var(--green)]"
                              : "bg-[var(--blue)]/15 text-[var(--blue)]"
                          }`}
                        >
                          {p.decision === "proceeded"
                            ? "bought"
                            : p.decision === "cancelled"
                            ? "skipped"
                            : "pending"}
                        </span>
                        {p.decision === "pending" && (
                          <button
                            onClick={() => startEditPurchase(p)}
                            title="Edit"
                            className="text-xs text-[var(--muted2)] hover:text-[var(--blue)] transition"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function GoalRow({
  item,
  onToggle,
  onDelete,
  onAddFunds,
  onEdit,
}: {
  item: WishlistItem;
  onToggle: () => void;
  onDelete: () => void;
  onAddFunds?: (amount: number) => void;
  onEdit?: (name: string, price: number, priority: number) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPrice, setEditPrice] = useState(item.price.toString());
  const [editPriority, setEditPriority] = useState(item.priority);
  const pct = Math.min(100, Math.round((item.savedAmount / item.price) * 100));

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(addAmount);
    if (!amount || !onAddFunds) return;
    onAddFunds(amount);
    setAddAmount("");
    setShowAdd(false);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName || !editPrice || !onEdit) return;
    onEdit(editName, Number(editPrice), editPriority);
    setShowEdit(false);
  }

  return (
    <div
      className={`bg-[var(--s1)] rounded-xl p-4 border border-[var(--border2)] ${
        item.achieved ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-semibold text-white bg-gradient-to-br from-[var(--blue)] to-[var(--purple)]">
          {PRIORITY_LABEL[item.priority]}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`font-display font-semibold text-[var(--white)] ${
              item.achieved ? "line-through" : ""
            }`}
          >
            {item.name}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--blue)] to-[var(--cyan)] rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-xs text-[var(--muted2)] flex-shrink-0">
              {pct}%
            </span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-mono font-semibold text-[var(--white)]">
            {money(item.price)}
          </p>
          <p className="font-mono text-xs text-[var(--cyan)]">
            {money(item.savedAmount)} saved
          </p>
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              const url = `${window.location.origin}/goal/${item.id}`;
              navigator.clipboard.writeText(url);
              setJustCopied(true);
              setTimeout(() => setJustCopied(false), 1500);
            }}
            title="Copy shareable link"
            className="text-xs text-[var(--muted2)] hover:text-[var(--purple)] transition"
          >
            {justCopied ? "✓" : "⇗"}
          </button>
          {!item.achieved && onEdit && (
            <button
              onClick={() => setShowEdit((s) => !s)}
              title="Edit"
              className="text-xs text-[var(--muted2)] hover:text-[var(--blue)] transition"
            >
              ✎
            </button>
          )}
          {!item.achieved && onAddFunds && (
            <button
              onClick={() => setShowAdd((s) => !s)}
              title="Add funds"
              className="text-xs text-[var(--muted2)] hover:text-[var(--cyan)] transition"
            >
              +
            </button>
          )}
          <button
            onClick={onToggle}
            title={item.achieved ? "Mark as not achieved" : "Mark as achieved"}
            className="text-xs text-[var(--muted2)] hover:text-[var(--green)] transition"
          >
            {item.achieved ? "↺" : "✓"}
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="text-xs text-[var(--muted2)] hover:text-[var(--red)] transition"
          >
            ✕
          </button>
        </div>
      </div>

      {showEdit && onEdit && (
        <form onSubmit={submitEdit} className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)] flex-wrap">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 min-w-[120px] rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
          />
          <input
            type="number"
            min="0"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            className="w-28 rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
          />
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(Number(e.target.value))}
            className="rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
          >
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white text-sm font-medium px-4 hover:opacity-90 transition"
          >
            Save
          </button>
        </form>
      )}

      {showAdd && onAddFunds && (
        <form onSubmit={submitAdd} className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
          <input
            type="number"
            min="0"
            autoFocus
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--border2)] bg-[var(--s2)] px-3 py-2 text-sm text-[var(--white)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            placeholder="Amount to add"
          />
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white text-sm font-medium px-4 hover:opacity-90 transition"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
