import { beforeAll, describe, expect, test } from "bun:test";
import { adaptStream } from "../compat/adapt-stream.js";
import { query } from "../compat/query.js";
import { registerProvider } from "../registry.js";
import type { StreamChunk } from "../types.js";

async function* fakeStream(): AsyncGenerator<StreamChunk> {
  yield { type: "text", text: "hello " };
  yield { type: "text", text: "world" };
  yield {
    type: "tool_call",
    toolName: "get_weather",
    toolArgs: { city: "SF" },
    toolCallId: "call_1",
  };
  yield { type: "tool_result", toolCallId: "call_1", result: '{"temp":72}' };
  yield { type: "handoff", fromAgent: "a", toAgent: "b" };
  yield { type: "error", error: "oops" };
  yield { type: "done", text: "hello world" };
}

async function collectMessages() {
  const msgs: any[] = [];
  for await (const msg of adaptStream(fakeStream())) {
    msgs.push(msg);
  }
  return msgs;
}

describe("adaptStream()", () => {
  let msgs: any[];

  beforeAll(async () => {
    msgs = await collectMessages();
  });

  test("emits init message first", () => {
    expect(msgs[0].type).toBe("system");
    expect(msgs[0].subtype).toBe("init");
    expect(msgs[0].session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("maps text chunks to assistant messages", () => {
    const textMsgs = msgs.filter(
      (m) => m.type === "assistant" && m.message?.content?.[0]?.type === "text",
    );
    expect(textMsgs).toHaveLength(3); // 2 text + 1 handoff
    expect(textMsgs[0].message.content[0].text).toBe("hello ");
    expect(textMsgs[1].message.content[0].text).toBe("world");
  });

  test("maps tool_call to assistant tool_use message", () => {
    const toolMsg = msgs.find((m) => m.message?.content?.[0]?.type === "tool_use");
    expect(toolMsg).toBeDefined();
    expect(toolMsg.message.content[0].name).toBe("get_weather");
    expect(toolMsg.message.content[0].input).toEqual({ city: "SF" });
    expect(toolMsg.message.content[0].id).toBe("call_1");
  });

  test("maps tool_result to result message", () => {
    const resultMsg = msgs.find((m) => m.type === "result" && m.tool_use_id);
    expect(resultMsg).toBeDefined();
    expect(resultMsg.tool_use_id).toBe("call_1");
    expect(resultMsg.content).toBe('{"temp":72}');
  });

  test("maps error to result with error subtype", () => {
    const errorMsg = msgs.find((m) => m.subtype === "error_during_execution");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.error).toBe("oops");
  });

  test("maps done to result with success subtype", () => {
    const doneMsg = msgs.find((m) => m.subtype === "success");
    expect(doneMsg).toBeDefined();
    expect(doneMsg.text).toBe("hello world");
  });
});

describe("query()", () => {
  test("routes to custom provider via options.provider", async () => {
    registerProvider("test-compat", async () => ({
      async *run() {
        yield { type: "text" as const, text: "from custom" };
        yield { type: "done" as const, text: "from custom" };
      },
      async *chat() {
        yield { type: "done" as const };
      },
      async close() {},
    }));

    const msgs: any[] = [];
    for await (const msg of query({
      prompt: "hello",
      options: { provider: "test-compat" },
    })) {
      msgs.push(msg);
    }

    expect(msgs[0].type).toBe("system");
    expect(msgs[0].subtype).toBe("init");
    const textMsg = msgs.find((m) => m.type === "assistant");
    expect(textMsg.message.content[0].text).toBe("from custom");
  });

  test("rejects unknown provider", async () => {
    const msgs: any[] = [];
    try {
      for await (const msg of query({
        prompt: "hello",
        options: { provider: "nonexistent" },
      })) {
        msgs.push(msg);
      }
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.message).toContain("Unknown provider");
    }
  });
});
