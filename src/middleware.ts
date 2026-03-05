import type { Middleware, MiddlewareContext, StreamChunk } from "./types.js";

export function defineMiddleware(fn: Middleware): Middleware {
  return fn;
}

export function applyMiddleware(
  stream: AsyncGenerator<StreamChunk>,
  middleware: Middleware[],
  context: MiddlewareContext,
): AsyncGenerator<StreamChunk> {
  return middleware.reduce((s, mw) => mw(s, context), stream);
}
