import Anthropic from "@anthropic-ai/sdk";

// Fast/cheap for light structured work (parse text→tasks, day tags).
export const MODEL_FAST = "claude-haiku-4-5";
// Higher quality for the headline planning (day schedule, smart-slot).
export const MODEL_SMART = "claude-sonnet-4-6";

export function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  return new Anthropic({ apiKey: key });
}

// Claude returns text; pull the first {...} JSON block out robustly.
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in model output");
  return JSON.parse(text.slice(start, end + 1));
}
