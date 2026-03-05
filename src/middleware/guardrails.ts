import type { Middleware, StreamChunk } from "../types.js";
import { defineMiddleware } from "./core.js";

export interface GuardrailsOptions {
  /** Block text containing any of these keywords */
  blockedKeywords?: string[];
  /** Custom validation: true = allow, false = block, string = replace */
  validate?: (text: string) => boolean | string;
  /** What to do when blocked: "error" (default) or "drop" */
  onBlock?: "error" | "drop";
  /** Case-insensitive keyword matching (default: true) */
  caseInsensitive?: boolean;
}

export function guardrails(options: GuardrailsOptions): Middleware {
  const { blockedKeywords = [], validate, onBlock = "error", caseInsensitive = true } = options;

  const normalizedKeywords = caseInsensitive
    ? blockedKeywords.map((k) => k.toLowerCase())
    : blockedKeywords;

  return defineMiddleware(async function* (stream) {
    for await (const chunk of stream) {
      if (chunk.type !== "text") {
        yield chunk;
        continue;
      }

      const textToCheck = caseInsensitive ? chunk.text.toLowerCase() : chunk.text;
      const blocked = normalizedKeywords.some((kw) => textToCheck.includes(kw));

      if (blocked) {
        if (onBlock === "error") {
          yield { type: "error", error: "Content blocked by guardrails" } satisfies StreamChunk;
        }
        continue;
      }

      if (validate) {
        const result = validate(chunk.text);
        if (result === false) {
          if (onBlock === "error") {
            yield { type: "error", error: "Content blocked by guardrails" } satisfies StreamChunk;
          }
          continue;
        }
        if (typeof result === "string") {
          yield { type: "text", text: result } satisfies StreamChunk;
          continue;
        }
      }

      yield chunk;
    }
  });
}
