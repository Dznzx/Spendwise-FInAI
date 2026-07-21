import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: [{ achieved: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, price, priority, savedAmount } = await req.json();
  if (!name || !price) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const item = await prisma.wishlistItem.create({
    data: {
      userId,
      name,
      price: Number(price),
      priority: priority ?? 1,
      savedAmount: savedAmount ?? 0,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
