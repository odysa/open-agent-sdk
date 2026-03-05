import type { Middleware, StreamChunk } from "../types.js";
import { defineMiddleware } from "./core.js";

export interface LoggingOptions {
  /** Custom logging function (default: console.log) */
  logger?: (message: string, chunk: StreamChunk) => void;
  /** Which chunk types to log (default: all) */
  types?: StreamChunk["type"][];
  /** Prefix label (default: "[middleware:logging]") */
  label?: string;
}

export function logging(options: LoggingOptions = {}): Middleware {
  const { logger, types, label = "[middleware:logging]" } = options;
  const log = logger ?? ((message: string, _chunk: StreamChunk) => console.log(message));
  const typeSet = types ? new Set<string>(types) : null;

  return defineMiddleware(async function* (stream) {
    for await (const chunk of stream) {
      if (!typeSet || typeSet.has(chunk.type)) {
        log(`${label} ${chunk.type}: ${JSON.stringify(chunk)}`, chunk);
      }
      yield chunk;
    }
  });
}
