import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [decided, budgets] = await Promise.all([
    prisma.purchase.findMany({
      where: { userId, decision: { in: ["proceeded", "cancelled"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.budget.findMany({ where: { userId } }),
  ]);
  type PurchaseRow = (typeof decided)[number];
  type BudgetRow = (typeof budgets)[number];

  const thisMonth = decided.filter((p: PurchaseRow) => p.createdAt >= monthStart);

  const totalSaved = thisMonth
    .filter((p: PurchaseRow) => p.decision === "cancelled")
    .reduce((sum: number, p: PurchaseRow) => sum + p.amount, 0);

  const totalSpent = thisMonth
    .filter((p: PurchaseRow) => p.decision === "proceeded")
    .reduce((sum: number, p: PurchaseRow) => sum + p.amount, 0);

  const skipCount = thisMonth.filter((p: PurchaseRow) => p.decision === "cancelled").length;
  const spendCount = thisMonth.filter((p: PurchaseRow) => p.decision === "proceeded").length;

  // Streak looks at the full history, not just this month, since a streak
  // spanning a month boundary should still count.
  let currentStreak = 0;
  for (const p of decided) {
    if (p.decision === "cancelled") currentStreak++;
    else break;
  }

  const categoryTotals: Record<string, number> = {};
  for (const p of thisMonth) {
    if (p.decision === "proceeded") {
      categoryTotals[p.category] = (categoryTotals[p.category] || 0) + p.amount;
    }
  }

  const categoryBreakdown = Object.keys({ ...categoryTotals, ...Object.fromEntries(budgets.map((b: BudgetRow) => [b.category, 0])) })
    .map((category: string) => {
      const budget = budgets.find((b: BudgetRow) => b.category === category);
      return {
        category,
        amount: categoryTotals[category] || 0,
        limit: budget?.monthlyLimit ?? null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    totalSaved,
    totalSpent,
    skipCount,
    spendCount,
    currentStreak,
    categoryBreakdown,
    monthLabel: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
  });
}
