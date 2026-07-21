import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

async function assertOwnership(id: string, userId: string) {
  const item = await prisma.wishlistItem.findUnique({ where: { id } });
  return item && item.userId === userId ? item : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await assertOwnership(id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const item = await prisma.wishlistItem.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      price: body.price !== undefined ? Number(body.price) : undefined,
      priority: body.priority ?? undefined,
      savedAmount: body.savedAmount !== undefined ? Number(body.savedAmount) : undefined,
      achieved: body.achieved ?? undefined,
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await assertOwnership(id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.wishlistItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
