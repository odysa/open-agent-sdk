import type { Middleware } from "../types.js";
import { defineMiddleware } from "./core.js";

export interface TimingInfo {
  /** Time to first chunk of any type (ms) */
  timeToFirstChunk: number;
  /** Time to first text chunk (ms) */
  timeToFirstText: number | null;
  /** Total stream duration (ms) */
  duration: number;
}

export interface TimingOptions {
  /** Callback when first text chunk arrives */
  onFirstText?: (elapsed: number) => void;
  /** Callback when stream completes */
  onComplete?: (info: TimingInfo) => void;
}

export interface TimingHandle {
  middleware: Middleware;
  getInfo(): TimingInfo | null;
}

export function timing(options: TimingOptions = {}): TimingHandle {
  let info: TimingInfo | null = null;

  const middleware = defineMiddleware(async function* (stream) {
    const start = performance.now();
    let timeToFirstChunk: number | null = null;
    let timeToFirstText: number | null = null;

    for await (const chunk of stream) {
      if (timeToFirstChunk === null || timeToFirstText === null) {
        const now = performance.now();

        if (timeToFirstChunk === null) {
          timeToFirstChunk = now - start;
        }

        if (timeToFirstText === null && chunk.type === "text") {
          timeToFirstText = now - start;
          options.onFirstText?.(timeToFirstText);
        }
      }

      yield chunk;
    }

    const duration = performance.now() - start;
    info = { timeToFirstChunk: timeToFirstChunk ?? 0, timeToFirstText, duration };
    options.onComplete?.(info);
  });

  return {
    middleware,
    getInfo: () => (info ? { ...info } : null),
  };
}
