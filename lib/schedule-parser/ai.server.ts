import { AI_TIMEOUT_MS, client, extractJson, withTimeout } from "@/lib/claude";
import { normalizeParsedSchedule } from "@/lib/schedule-parser/normalizer";
import { buildScheduleSystemPrompt, SCHEDULE_MODEL_JSON_SCHEMA, SCHEDULE_PARSER_MODEL } from "@/lib/schedule-parser/prompt";
import {
  ParsedScheduleSchema,
  ScheduleParserRequestSchema,
  type ParseScheduleRequest,
  type ParsedSchedule,
  type ScheduleParser,
} from "@/lib/schedule-parser/schema";

const ModelScheduleSchema = ParsedScheduleSchema.omit({ metadata: true, timezone: true });

export class AiScheduleParser implements ScheduleParser {
  async parse(rawInput: ParseScheduleRequest): Promise<ParsedSchedule> {
    const input = ScheduleParserRequestSchema.parse(rawInput);
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const message = await withTimeout(client().messages.create({
          model: SCHEDULE_PARSER_MODEL,
          max_tokens: 5_000,
          system: buildScheduleSystemPrompt(input.referenceDate),
          output_config: { format: { type: "json_schema", schema: SCHEDULE_MODEL_JSON_SCHEMA } },
          messages: [{ role: "user", content: input.text }],
        }), AI_TIMEOUT_MS, "schedule parse");
        const output = message.content.map((block) => block.type === "text" ? block.text : "").join("");
        const modelValue = ModelScheduleSchema.parse(extractJson(output));
        return normalizeParsedSchedule(modelValue, "ai", SCHEDULE_PARSER_MODEL);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("invalid_schedule_response");
  }
}
