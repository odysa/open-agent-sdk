import type { z } from "zod";
/**
 * Convert a Zod schema to JSON Schema.
 * Uses Zod v4's built-in toJSONSchema() if available,
 * otherwise falls back to a basic conversion.
 */
export declare function zodToJsonSchema(schema: z.ZodType): Record<string, unknown>;
