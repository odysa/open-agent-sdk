import { z } from "zod";

/** Convert a Zod schema to JSON Schema using Zod v4's built-in conversion */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}
