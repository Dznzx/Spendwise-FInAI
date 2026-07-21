import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  if (body.description !== undefined || body.amount !== undefined || body.category !== undefined) {
    if (existing.decision !== "pending") {
      return NextResponse.json(
        { error: "Can't edit a purchase that's already been decided" },
        { status: 400 }
      );
    }
    const purchase = await prisma.purchase.update({
      where: { id },
      data: {
        description: body.description ?? undefined,
        amount: body.amount !== undefined ? Number(body.amount) : undefined,
        category: body.category ?? undefined,
      },
    });
    return NextResponse.json({ purchase });
  }
  const { decision } = body;
  if (!["proceeded", "cancelled"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }
  const alreadyDecided = existing.decision === "proceeded" || existing.decision === "cancelled";
  // All goals linked to this purchase — primary plus any additional ones.
  const allGoalIds = [
    ...(existing.wishlistItemId ? [existing.wishlistItemId] : []),
    ...existing.additionalGoalIds,
  ];
  const purchase = await prisma.$transaction(async (tx: TransactionClient) => {
    const updated = await tx.purchase.update({ where: { id }, data: { decision } });
    if (!alreadyDecided && decision === "cancelled" && allGoalIds.length > 0) {
      // Split the saved amount evenly across every linked goal.
      const share = existing.amount / allGoalIds.length;
      for (const goalId of allGoalIds) {
        await tx.wishlistItem.update({
          where: { id: goalId },
          data: { savedAmount: { increment: share } },
        });
      }
    }
    return updated;
  });
  return NextResponse.json({ purchase });
}
