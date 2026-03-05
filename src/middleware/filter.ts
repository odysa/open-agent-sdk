import type { Middleware, StreamChunk } from "../types.js";
import { defineMiddleware } from "./core.js";

export interface FilterOptions {
  /** Chunk types to drop */
  exclude?: StreamChunk["type"][];
  /** Chunk types to keep (exclusive with exclude) */
  include?: StreamChunk["type"][];
  /** Custom predicate (overrides include/exclude) */
  predicate?: (chunk: StreamChunk) => boolean;
}

export function filter(options: FilterOptions): Middleware {
  let check: (chunk: StreamChunk) => boolean;
  if (options.predicate) {
    check = options.predicate;
  } else if (options.include) {
    const set = new Set<string>(options.include);
    check = (c) => set.has(c.type);
  } else if (options.exclude) {
    const set = new Set<string>(options.exclude);
    check = (c) => !set.has(c.type);
  } else {
    check = () => true;
  }

  return defineMiddleware(async function* (stream) {
    for await (const chunk of stream) {
      if (check(chunk)) yield chunk;
    }
  });
}
