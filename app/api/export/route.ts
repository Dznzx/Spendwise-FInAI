import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

function csvEscape(val: string) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const purchases = await prisma.purchase.findMany({
    where: { userId },
    include: { wishlistItem: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  type PurchaseRow = (typeof purchases)[number];

  const header = ["Date", "Description", "Amount", "Category", "Weighed Against", "Decision"];
  const rows = purchases.map((p: PurchaseRow) => [
    p.createdAt.toISOString().split("T")[0],
    csvEscape(p.description),
    p.amount.toString(),
    p.category,
    p.wishlistItem?.name ?? "",
    p.decision,
  ]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="spendwise-history-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
