import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const budgets = await prisma.budget.findMany({ where: { userId } });
  return NextResponse.json({ budgets });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, monthlyLimit } = await req.json();
  if (!category || monthlyLimit === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const budget = await prisma.budget.upsert({
    where: { userId_category: { userId, category } },
    update: { monthlyLimit: Number(monthlyLimit) },
    create: { userId, category, monthlyLimit: Number(monthlyLimit) },
  });

  return NextResponse.json({ budget });
}
