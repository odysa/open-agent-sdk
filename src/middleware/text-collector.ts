import type { Middleware } from "../types.js";
import { defineMiddleware } from "./core.js";

export interface TextCollectorOptions {
  /** Callback on each text chunk with running accumulated text */
  onText?: (text: string) => void;
  /** Callback when stream completes with final text */
  onComplete?: (text: string) => void;
  /** Use done.text as authoritative when available (default: true) */
  preferDoneText?: boolean;
}

export interface TextCollectorHandle {
  middleware: Middleware;
  getText(): string;
}

export function textCollector(options: TextCollectorOptions = {}): TextCollectorHandle {
  const { preferDoneText = true } = options;
  let collected = "";

  const middleware = defineMiddleware(async function* (stream) {
    collected = "";

    for await (const chunk of stream) {
      if (chunk.type === "text") {
        collected += chunk.text;
        options.onText?.(collected);
      }

      if (chunk.type === "done" && preferDoneText && chunk.text != null) {
        collected = chunk.text;
      }

      yield chunk;
    }

    options.onComplete?.(collected);
  });

  return {
    middleware,
    getText: () => collected,
  };
}
