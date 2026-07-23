import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { generateTradeoffSummary } from "@/lib/ai";

const CATEGORIES = ["food", "shopping", "entertainment", "transport", "bills", "subscriptions", "miscellaneous"];

type ParsedIntent = {
  intent: "log_purchase" | "chat";
  description?: string;
  amount?: number;
  category?: string;
  goalNames?: string[];
  reply?: string;
};

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await req.json();
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const goals = await prisma.wishlistItem.findMany({
    where: { userId, achieved: false },
    select: { id: true, name: true, price: true, savedAmount: true },
  });
  type Goal = (typeof goals)[number];

  const apiKey = process.env.GEMINI_API_KEY;
  const goalList = goals.map((g: Goal) => g.name).join(", ") || "none";

  let parsed: ParsedIntent = {
    intent: "chat",
    reply:
      "I can help you log a purchase or answer questions about your goals — try telling me what you're about to buy, e.g. \"₹1500 on a dinner out\".",
  };

  if (apiKey && apiKey !== "your-gemini-key-here") {
    const prompt = `You are SpendWise's AI spending advisor, embedded in a chat UI. The user's active savings goals: ${goalList}. Valid spending categories: ${CATEGORIES.join(", ")}.
The user just said: "${message.replace(/"/g, "'")}"

Decide if this is them describing a purchase they're about to make or have just made (intent "log_purchase") or something else — a question, greeting, or general chat (intent "chat").

Respond with ONLY a raw JSON object, no markdown fences, no preamble, matching exactly this shape:
{"intent":"log_purchase" or "chat","description":"<short purchase description, empty string if intent is chat>","amount":<number, 0 if intent is chat>,"category":"<one of the valid categories, best guess, miscellaneous if unsure>","goalNames":[<any of the user's exact goal names this purchase should be weighed against, empty array if none or unclear>],"reply":"<if intent is chat: a short, warm, helpful reply under 30 words; if intent is log_purchase: empty string>"}`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
        config: { maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
      });
      const text = response.text ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Gemini chat parse: no JSON object found in response:", text);
      } else {
        const obj = JSON.parse(match[0]);
        if (obj && (obj.intent === "log_purchase" || obj.intent === "chat")) {
          parsed = obj;
        } else {
          console.error("Gemini chat parse: unexpected shape:", obj);
        }
      }
    } catch (err) {
      console.error("Gemini chat parse failed:", err);
    }
  }

  if (parsed.intent === "log_purchase" && parsed.description && parsed.amount && parsed.amount > 0) {
    const matchedGoals = goals.filter((g: Goal) =>
      (parsed.goalNames ?? []).some((n) => n.toLowerCase() === g.name.toLowerCase())
    );
    const goalsForAi = matchedGoals.map((g: Goal) => ({ name: g.name, price: g.price, savedAmount: g.savedAmount }));
    const aiSummary = await generateTradeoffSummary(parsed.description, Number(parsed.amount), goalsForAi);

    const primaryGoalId = matchedGoals[0]?.id ?? null;
    const extraIds = matchedGoals.slice(1).map((g: Goal) => g.id);
    const category = CATEGORIES.includes(parsed.category ?? "") ? (parsed.category as string) : "miscellaneous";

    const purchase = await prisma.purchase.create({
      data: {
        userId,
        description: parsed.description,
        amount: Number(parsed.amount),
        category,
        wishlistItemId: primaryGoalId,
        additionalGoalIds: extraIds,
        aiSummary,
        decision: "pending",
      },
    });

    return NextResponse.json({
      intent: "log_purchase",
      purchase: {
        ...purchase,
        wishlistItem: matchedGoals[0] ? { name: matchedGoals[0].name } : null,
        additionalGoalNames: matchedGoals.slice(1).map((g: Goal) => g.name),
      },
    });
  }

  return NextResponse.json({
    intent: "chat",
    reply: parsed.reply || "Tell me what you're about to buy and I'll show you the trade-off.",
  });
}
