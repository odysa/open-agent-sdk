import { describe, expect, test } from "bun:test";
import { applyMiddleware, defineMiddleware } from "../middleware.js";
import type { MiddlewareContext, StreamChunk } from "../types.js";
import { collect, fromChunks } from "./mock-provider.js";

const mockContext: MiddlewareContext = {
  agent: { name: "test-agent", description: "Test", prompt: "You are a test agent." },
  provider: "claude",
};

describe("defineMiddleware", () => {
  test("returns the same function", () => {
    const mw = defineMiddleware(async function* (stream) {
      yield* stream;
    });
    expect(typeof mw).toBe("function");
  });
});

describe("applyMiddleware", () => {
  test("passthrough with empty middleware array", async () => {
    const chunks: StreamChunk[] = [{ type: "text", text: "hello" }, { type: "done" }];
    const result = await collect(applyMiddleware(fromChunks(chunks), [], mockContext));
    expect(result).toEqual(chunks);
  });

  test("single middleware transforms text chunks to uppercase", async () => {
    const chunks: StreamChunk[] = [
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
      { type: "done" },
    ];

    const upperMw = defineMiddleware(async function* (stream) {
      for await (const chunk of stream) {
        if (chunk.type === "text") {
          yield { ...chunk, text: chunk.text.toUpperCase() };
        } else {
          yield chunk;
        }
      }
    });

    const result = await collect(applyMiddleware(fromChunks(chunks), [upperMw], mockContext));
    expect(result).toEqual([
      { type: "text", text: "HELLO" },
      { type: "text", text: "WORLD" },
      { type: "done" },
    ]);
  });

  test("multiple middleware compose in order", async () => {
    const chunks: StreamChunk[] = [{ type: "text", text: "hello" }];

    const appendA = defineMiddleware(async function* (stream) {
      for await (const chunk of stream) {
        if (chunk.type === "text") {
          yield { ...chunk, text: `${chunk.text}A` };
        } else {
          yield chunk;
        }
      }
    });

    const appendB = defineMiddleware(async function* (stream) {
      for await (const chunk of stream) {
        if (chunk.type === "text") {
          yield { ...chunk, text: `${chunk.text}B` };
        } else {
          yield chunk;
        }
      }
    });

    const result = await collect(
      applyMiddleware(fromChunks(chunks), [appendA, appendB], mockContext),
    );
    // appendA runs first, then appendB on its output
    expect(result).toEqual([{ type: "text", text: "helloAB" }]);
  });

  test("middleware can filter/drop chunks", async () => {
    const chunks: StreamChunk[] = [
      { type: "text", text: "keep" },
      { type: "tool_call", toolName: "my_tool", toolArgs: {}, toolCallId: "1" },
      { type: "text", text: "also keep" },
    ];

    const dropToolCalls = defineMiddleware(async function* (stream) {
      for await (const chunk of stream) {
        if (chunk.type !== "tool_call") {
          yield chunk;
        }
      }
    });

    const result = await collect(applyMiddleware(fromChunks(chunks), [dropToolCalls], mockContext));
    expect(result).toEqual([
      { type: "text", text: "keep" },
      { type: "text", text: "also keep" },
    ]);
  });

  test("middleware receives correct context", async () => {
    const chunks: StreamChunk[] = [{ type: "done" }];
    const capturedContexts: MiddlewareContext[] = [];

    const captureMw = defineMiddleware(async function* (stream, ctx) {
      capturedContexts.push(ctx);
      yield* stream;
    });

    await collect(applyMiddleware(fromChunks(chunks), [captureMw], mockContext));
    expect(capturedContexts).toHaveLength(1);
    expect(capturedContexts[0]).toEqual(mockContext);
  });

  test("multiple middleware each receive the same context", async () => {
    const chunks: StreamChunk[] = [{ type: "done" }];
    const capturedContexts: MiddlewareContext[] = [];

    const mw1 = defineMiddleware(async function* (stream, ctx) {
      capturedContexts.push(ctx);
      yield* stream;
    });

    const mw2 = defineMiddleware(async function* (stream, ctx) {
      capturedContexts.push(ctx);
      yield* stream;
    });

    await collect(applyMiddleware(fromChunks(chunks), [mw1, mw2], mockContext));
    expect(capturedContexts).toHaveLength(2);
    expect(capturedContexts[0]).toEqual(mockContext);
    expect(capturedContexts[1]).toEqual(mockContext);
  });

  test("no middleware leaves stream unchanged", async () => {
    const chunks: StreamChunk[] = [{ type: "text", text: "unchanged" }, { type: "done" }];
    const result = await collect(applyMiddleware(fromChunks(chunks), [], mockContext));
    expect(result).toEqual(chunks);
  });
});
