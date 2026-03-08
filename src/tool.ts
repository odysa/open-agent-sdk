import type { z } from "zod";
import type { ToolDef } from "./types.js";

/**
 * Convenience helper to define a tool with type-safe parameters.
 * @deprecated Will be removed in v0.2. Use `tool()` from `one-agent-sdk` instead.
 */
export function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  parameters: T;
  handler: (params: z.infer<T>) => Promise<string>;
}): ToolDef<T> {
  return config;
}
