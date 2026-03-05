import { describe, expect, test } from "bun:test";
import {
  filter,
  guardrails,
  hooks,
  logging,
  textCollector,
  timing,
  usageTracker,
} from "../middleware/index.js";
import type { MiddlewareContext, StreamChunk } from "../types.js";
import { collect, fromChunks } from "./mock-provider.js";

const ctx: MiddlewareContext = {
  agent: { name: "test", description: "Test", prompt: "Test" },
  provider: "claude-code",
};

function apply(chunks: StreamChunk[], mw: ReturnType<typeof logging>) {
  return collect(mw(fromChunks(chunks), ctx));
}

// --- logging ---

describe("logging", () => {
  test("logs all chunks by default and passes through", async () => {
    const logged: string[] = [];
    const mw = logging({ logger: (msg) => logged.push(msg) });
    const chunks: StreamChunk[] = [{ type: "text", text: "hi" }, { type: "done" }];
    const result = await apply(chunks, mw);
    expect(result).toEqual(chunks);
    expect(logged).toHaveLength(2);
  });

  test("filters by chunk type", async () => {
    const logged: string[] = [];
    const mw = logging({ logger: (msg) => logged.push(msg), types: ["text"] });
    const chunks: StreamChunk[] = [{ type: "text", text: "hi" }, { type: "done" }];
    await apply(chunks, mw);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("text");
  });

  test("uses custom label", async () => {
    const logged: string[] = [];
    const mw = logging({ logger: (msg) => logged.push(msg), label: "[custom]" });
    await apply([{ type: "done" }], mw);
    expect(logged[0]).toStartWith("[custom]");
  });
});

// --- usageTracker ---

describe("usageTracker", () => {
  test("accumulates usage from done chunks", async () => {
    const tracker = usageTracker();
    const chunks: StreamChunk[] = [
      { type: "text", text: "hi" },
      { type: "done", usage: { inputTokens: 10, outputTokens: 20 } },
    ];
    await apply(chunks, tracker.middleware);
    expect(tracker.getStats()).toEqual({ inputTokens: 10, outputTokens: 20, requests: 1 });
  });

  test("accumulates across multiple done chunks", async () => {
    const tracker = usageTracker();
    const chunks: StreamChunk[] = [{ type: "done", usage: { inputTokens: 10, outputTokens: 20 } }];
    await apply(chunks, tracker.middleware);
    await apply(chunks, tracker.middleware);
    expect(tracker.getStats()).toEqual({ inputTokens: 20, outputTokens: 40, requests: 2 });
  });

  test("reset clears stats", async () => {
    const tracker = usageTracker();
    await apply(
      [{ type: "done", usage: { inputTokens: 10, outputTokens: 20 } }],
      tracker.middleware,
    );
    tracker.reset();
    expect(tracker.getStats()).toEqual({ inputTokens: 0, outputTokens: 0, requests: 0 });
  });

  test("fires onUsage callback", async () => {
    const usages: { inputTokens: number; outputTokens: number }[] = [];
    const tracker = usageTracker({ onUsage: (s) => usages.push(s) });
    await apply(
      [{ type: "done", usage: { inputTokens: 5, outputTokens: 10 } }],
      tracker.middleware,
    );
    expect(usages).toHaveLength(1);
    expect(usages[0].inputTokens).toBe(5);
  });

  test("ignores done chunks without usage", async () => {
    const tracker = usageTracker();
    await apply([{ type: "done" }], tracker.middleware);
    expect(tracker.getStats()).toEqual({ inputTokens: 0, outputTokens: 0, requests: 0 });
  });
});

// --- timing ---

describe("timing", () => {
  test("calls onFirstText with elapsed time", async () => {
    let ttft = -1;
    const t = timing({ onFirstText: (ms) => (ttft = ms) });
    await apply([{ type: "text", text: "hi" }, { type: "done" }], t.middleware);
    expect(ttft).toBeGreaterThanOrEqual(0);
  });

  test("calls onComplete with timing info", async () => {
    const t = timing();
    await apply([{ type: "text", text: "hi" }, { type: "done" }], t.middleware);
    const info = t.getInfo();
    expect(info).not.toBeNull();
    expect(info?.duration).toBeGreaterThanOrEqual(0);
    expect(info?.timeToFirstText).toBeGreaterThanOrEqual(0);
    expect(info?.timeToFirstChunk).toBeGreaterThanOrEqual(0);
  });

  test("timeToFirstText is null when no text chunks", async () => {
    const t = timing();
    await apply([{ type: "done" }], t.middleware);
    expect(t.getInfo()?.timeToFirstText).toBeNull();
  });

  test("passes all chunks through", async () => {
    const t = timing();
    const chunks: StreamChunk[] = [{ type: "text", text: "hi" }, { type: "done" }];
    const result = await apply(chunks, t.middleware);
    expect(result).toEqual(chunks);
  });

  test("getInfo returns null before stream completes", () => {
    const t = timing();
    expect(t.getInfo()).toBeNull();
  });
});

// --- textCollector ---

describe("textCollector", () => {
  test("collects text from text chunks", async () => {
    const tc = textCollector();
    await apply(
      [{ type: "text", text: "hello " }, { type: "text", text: "world" }, { type: "done" }],
      tc.middleware,
    );
    expect(tc.getText()).toBe("hello world");
  });

  test("prefers done.text when available", async () => {
    const tc = textCollector();
    await apply(
      [
        { type: "text", text: "partial" },
        { type: "done", text: "full response" },
      ],
      tc.middleware,
    );
    expect(tc.getText()).toBe("full response");
  });

  test("uses accumulated text when preferDoneText is false", async () => {
    const tc = textCollector({ preferDoneText: false });
    await apply(
      [
        { type: "text", text: "partial" },
        { type: "done", text: "full response" },
      ],
      tc.middleware,
    );
    expect(tc.getText()).toBe("partial");
  });

  test("fires onText callback with running text", async () => {
    const texts: string[] = [];
    const tc = textCollector({ onText: (t) => texts.push(t) });
    await apply(
      [{ type: "text", text: "a" }, { type: "text", text: "b" }, { type: "done" }],
      tc.middleware,
    );
    expect(texts).toEqual(["a", "ab"]);
  });

  test("fires onComplete callback", async () => {
    let final = "";
    const tc = textCollector({ onComplete: (t) => (final = t) });
    await apply([{ type: "text", text: "hi" }, { type: "done" }], tc.middleware);
    expect(final).toBe("hi");
  });
});

// --- guardrails ---

describe("guardrails", () => {
  test("blocks text with blocked keywords", async () => {
    const mw = guardrails({ blockedKeywords: ["secret"] });
    const result = await apply(
      [{ type: "text", text: "this is secret info" }, { type: "done" }],
      mw,
    );
    expect(result[0]).toEqual({ type: "error", error: "Content blocked by guardrails" });
    expect(result[1]).toEqual({ type: "done" });
  });

  test("case insensitive by default", async () => {
    const mw = guardrails({ blockedKeywords: ["SECRET"] });
    const result = await apply([{ type: "text", text: "secret data" }], mw);
    expect(result[0].type).toBe("error");
  });

  test("case sensitive when configured", async () => {
    const mw = guardrails({ blockedKeywords: ["SECRET"], caseInsensitive: false });
    const result = await apply([{ type: "text", text: "secret data" }], mw);
    expect(result).toEqual([{ type: "text", text: "secret data" }]);
  });

  test("drops silently with onBlock: drop", async () => {
    const mw = guardrails({ blockedKeywords: ["bad"], onBlock: "drop" });
    const result = await apply(
      [{ type: "text", text: "bad" }, { type: "text", text: "good" }, { type: "done" }],
      mw,
    );
    expect(result).toEqual([{ type: "text", text: "good" }, { type: "done" }]);
  });

  test("validate replaces text", async () => {
    const mw = guardrails({ validate: (text) => (text === "replace me" ? "replaced" : true) });
    const result = await apply([{ type: "text", text: "replace me" }], mw);
    expect(result).toEqual([{ type: "text", text: "replaced" }]);
  });

  test("validate blocks text", async () => {
    const mw = guardrails({ validate: () => false });
    const result = await apply([{ type: "text", text: "anything" }], mw);
    expect(result[0].type).toBe("error");
  });

  test("passes non-text chunks through", async () => {
    const mw = guardrails({ blockedKeywords: ["secret"] });
    const chunks: StreamChunk[] = [
      { type: "tool_call", toolName: "secret", toolArgs: {}, toolCallId: "1" },
    ];
    const result = await apply(chunks, mw);
    expect(result).toEqual(chunks);
  });
});

// --- hooks ---

describe("hooks", () => {
  test("fires per-type callbacks", async () => {
    const texts: string[] = [];
    const dones: boolean[] = [];
    const mw = hooks({
      onText: (c) => texts.push(c.text),
      onDone: () => dones.push(true),
    });
    const chunks: StreamChunk[] = [{ type: "text", text: "hi" }, { type: "done" }];
    const result = await apply(chunks, mw);
    expect(result).toEqual(chunks);
    expect(texts).toEqual(["hi"]);
    expect(dones).toHaveLength(1);
  });

  test("fires onChunk for every chunk", async () => {
    const seen: StreamChunk["type"][] = [];
    const mw = hooks({ onChunk: (c) => seen.push(c.type) });
    await apply(
      [
        { type: "text", text: "a" },
        { type: "tool_call", toolName: "t", toolArgs: {}, toolCallId: "1" },
        { type: "done" },
      ],
      mw,
    );
    expect(seen).toEqual(["text", "tool_call", "done"]);
  });

  test("fires onToolCall, onToolResult, onHandoff, onError", async () => {
    const calls: string[] = [];
    const mw = hooks({
      onToolCall: () => calls.push("tool_call"),
      onToolResult: () => calls.push("tool_result"),
      onHandoff: () => calls.push("handoff"),
      onError: () => calls.push("error"),
    });
    await apply(
      [
        { type: "tool_call", toolName: "t", toolArgs: {}, toolCallId: "1" },
        { type: "tool_result", toolCallId: "1", result: "ok" },
        { type: "handoff", fromAgent: "a", toAgent: "b" },
        { type: "error", error: "err" },
      ],
      mw,
    );
    expect(calls).toEqual(["tool_call", "tool_result", "handoff", "error"]);
  });

  test("never transforms chunks", async () => {
    const mw = hooks({ onText: () => {}, onChunk: () => {} });
    const chunks: StreamChunk[] = [{ type: "text", text: "unchanged" }, { type: "done" }];
    const result = await apply(chunks, mw);
    expect(result).toEqual(chunks);
  });
});

// --- filter ---

describe("filter", () => {
  test("excludes specified types", async () => {
    const mw = filter({ exclude: ["tool_call", "tool_result"] });
    const result = await apply(
      [
        { type: "text", text: "hi" },
        { type: "tool_call", toolName: "t", toolArgs: {}, toolCallId: "1" },
        { type: "tool_result", toolCallId: "1", result: "ok" },
        { type: "done" },
      ],
      mw,
    );
    expect(result).toEqual([{ type: "text", text: "hi" }, { type: "done" }]);
  });

  test("includes only specified types", async () => {
    const mw = filter({ include: ["text"] });
    const result = await apply(
      [{ type: "text", text: "hi" }, { type: "error", error: "err" }, { type: "done" }],
      mw,
    );
    expect(result).toEqual([{ type: "text", text: "hi" }]);
  });

  test("custom predicate overrides include/exclude", async () => {
    const mw = filter({
      include: ["text"],
      predicate: (c) => c.type === "done",
    });
    const result = await apply([{ type: "text", text: "hi" }, { type: "done" }], mw);
    expect(result).toEqual([{ type: "done" }]);
  });

  test("passes all chunks when no options match", async () => {
    const mw = filter({});
    const chunks: StreamChunk[] = [{ type: "text", text: "hi" }, { type: "done" }];
    const result = await apply(chunks, mw);
    expect(result).toEqual(chunks);
  });
});
