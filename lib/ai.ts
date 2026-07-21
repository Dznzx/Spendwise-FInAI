type WishlistContext = {
  name: string;
  price: number;
  savedAmount: number;
};

export async function generateTradeoffSummary(
  purchaseDescription: string,
  amount: number,
  goals: WishlistContext[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const goalNames = goals.map((g) => g.name).join(", ");

  if (!apiKey || apiKey === "your-gemini-key-here") {
    return goals.length > 0
      ? `That ₹${amount.toLocaleString("en-IN")} on ${purchaseDescription} would leave your ${goalNames} fund${goals.length > 1 ? "s" : ""} needing a bit more time. (AI summaries need a GEMINI_API_KEY set to generate real ones.)`
      : `That's ₹${amount.toLocaleString("en-IN")} on ${purchaseDescription}. (Add a savings goal so SpendWise can show you a real trade-off, and set a GEMINI_API_KEY for AI summaries.)`;
  }

  const goalContext =
    goals.length > 0
      ? `The user's goal(s), which this purchase would trade off against: ${goals
          .map((g) => `"${g.name}" (target ₹${g.price}, currently saved ₹${g.savedAmount})`)
          .join("; ")}. If skipped, this amount would be split evenly across all linked goals.`
      : `The user has not linked this purchase to a specific savings goal.`;

  const prompt = `A user is about to spend ₹${amount} on: "${purchaseDescription}".
${goalContext}
Write a short, friendly, non-judgmental summary (under 40 words) of what this purchase costs them in terms of their goal(s), if any are linked. Be concrete and specific, not preachy. If there's no goal linked, gently note that and keep it brief. Return ONLY the summary text, no preamble, no quotes.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 500,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini API error:", await res.text());
      return `That's ₹${amount.toLocaleString("en-IN")} on ${purchaseDescription}. (Couldn't generate a summary right now — try again in a moment.)`;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || `That's ₹${amount.toLocaleString("en-IN")} on ${purchaseDescription}.`;
  } catch (err) {
    console.error("Gemini API request failed:", err);
    return `That's ₹${amount.toLocaleString("en-IN")} on ${purchaseDescription}. (Couldn't generate a summary right now.)`;
  }
}
