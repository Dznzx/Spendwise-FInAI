import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { generateTradeoffSummary } from "@/lib/ai";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const purchases = await prisma.purchase.findMany({
    where: { userId },
    include: { wishlistItem: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // additionalGoalIds is just an array of ids, not a relation — resolve names separately.
  const allExtraIds = [...new Set(purchases.flatMap((p) => p.additionalGoalIds))];
  const extraGoals = allExtraIds.length
    ? await prisma.wishlistItem.findMany({
        where: { id: { in: allExtraIds } },
        select: { id: true, name: true },
      })
    : [];
  const extraGoalMap = Object.fromEntries(extraGoals.map((g) => [g.id, g.name]));

  const withExtraNames = purchases.map((p) => ({
    ...p,
    additionalGoalNames: p.additionalGoalIds.map((id) => extraGoalMap[id]).filter(Boolean),
  }));

  return NextResponse.json({ purchases: withExtraNames });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { description, amount, wishlistItemId, additionalGoalIds, category } = await req.json();
  if (!description || !amount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const allGoalIds: string[] = [
    ...(wishlistItemId ? [wishlistItemId] : []),
    ...(Array.isArray(additionalGoalIds) ? additionalGoalIds : []),
  ];

  const goalItems =
    allGoalIds.length > 0
      ? await prisma.wishlistItem.findMany({ where: { id: { in: allGoalIds }, userId } })
      : [];

  const goalsForAi = goalItems.map((g) => ({ name: g.name, price: g.price, savedAmount: g.savedAmount }));

  const aiSummary = await generateTradeoffSummary(description, Number(amount), goalsForAi);

  const extraIds = allGoalIds.filter((id) => id !== wishlistItemId);

  const purchase = await prisma.purchase.create({
    data: {
      userId,
      description,
      amount: Number(amount),
      category: category || "miscellaneous",
      wishlistItemId: wishlistItemId || null,
      additionalGoalIds: extraIds,
      aiSummary,
      decision: "pending",
    },
  });

  return NextResponse.json({ purchase }, { status: 201 });
}
