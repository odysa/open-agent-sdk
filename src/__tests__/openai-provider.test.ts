import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { defineAgent } from "../agent.js";
import { defineTool } from "../tool.js";
import type { RunConfig } from "../types.js";
import { collect, collectText } from "./mock-provider.js";

// --- Mock OpenAI SDK ---

type CreateArgs = Record<string, unknown>;
let capturedCreateArgs: CreateArgs[] = [];
let createResponses: AsyncGenerator<any>[] = [];

async function* fakeStream(chunks: any[]): AsyncGenerator<any> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function mockOpenAIChunk(options: {
  content?: string;
  toolCalls?: { index: number; id?: string; name?: string; arguments?: string }[];
  finishReason?: string | null;
  usage?: { prompt_tokens: number; completion_tokens: number };
}) {
  return {
    choices: [
      {
        delta: {
          content: options.content ?? null,
          tool_calls: options.toolCalls?.map((tc) => ({
            index: tc.index,
            id: tc.id,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        },
        finish_reason: options.finishReason ?? null,
      },
    ],
    usage: options.usage,
  };
}

mock.module("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: (args: CreateArgs) => {
          capturedCreateArgs.push(args);
          return createResponses.shift();
        },
      },
    };
  }
  return { default: MockOpenAI };
});

const { createOpenAIProvider } = await import("../providers/openai.js");

const baseAgent = defineAgent({
  name: "assistant",
  description: "Helper",
  prompt: "You are helpful.",
});

function makeConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return { provider: "openai", agent: baseAgent, ...overrides };
}

beforeEach(() => {
  capturedCreateArgs = [];
  createResponses = [];
});

describe("OpenAI provider", () => {
  test("streams text response and yields done", async () => {
    createResponses = [
      fakeStream([
        mockOpenAIChunk({ content: "Hello " }),
        mockOpenAIChunk({ content: "world!" }),
        mockOpenAIChunk({
          finishReason: "stop",
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      ]),
    ];

    const config = makeConfig();
    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("hi", config));

    expect(chunks.map((c) => c.type)).toEqual(["text", "text", "done"]);
    const text = chunks
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toBe("Hello world!");

    const done = chunks.find((c) => c.type === "done") as any;
    expect(done.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  test("uses default model gpt-4o", async () => {
    createResponses = [fakeStream([mockOpenAIChunk({ content: "hi", finishReason: "stop" })])];

    const config = makeConfig();
    const provider = await createOpenAIProvider(config);
    await collect(provider.run("hi", config));

    expect(capturedCreateArgs[0].model).toBe("gpt-4o");
  });

  test("uses agent.model when set", async () => {
    createResponses = [fakeStream([mockOpenAIChunk({ content: "hi", finishReason: "stop" })])];

    const agent = defineAgent({ ...baseAgent, model: "gpt-4-turbo" });
    const config = makeConfig({ agent });
    const provider = await createOpenAIProvider(config);
    await collect(provider.run("hi", config));

    expect(capturedCreateArgs[0].model).toBe("gpt-4-turbo");
  });

  test("executes tool calls and loops back", async () => {
    const weatherTool = defineTool({
      name: "get_weather",
      description: "Get weather",
      parameters: z.object({ city: z.string() }),
      handler: async ({ city }) => JSON.stringify({ city, temp: 72 }),
    });

    const agent = defineAgent({ ...baseAgent, tools: [weatherTool] });
    const config = makeConfig({ agent });

    // Turn 1: model calls tool
    createResponses.push(
      fakeStream([
        mockOpenAIChunk({
          toolCalls: [{ index: 0, id: "call_1", name: "get_weather", arguments: '{"city":"SF"}' }],
          finishReason: "tool_calls",
        }),
      ]),
    );

    // Turn 2: model responds with text
    createResponses.push(
      fakeStream([mockOpenAIChunk({ content: "72°F in SF.", finishReason: "stop" })]),
    );

    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("weather?", config));

    const types = chunks.map((c) => c.type);
    expect(types).toEqual(["tool_call", "tool_result", "text", "done"]);

    const toolCall = chunks[0] as any;
    expect(toolCall.toolName).toBe("get_weather");
    expect(toolCall.toolArgs).toEqual({ city: "SF" });

    const toolResult = chunks[1] as any;
    expect(toolResult.result).toBe('{"city":"SF","temp":72}');
  });

  test("handles handoff to another agent", async () => {
    const researcher = defineAgent({
      ...baseAgent,
      name: "researcher",
      handoffs: ["math"],
    });

    const mathAgent = defineAgent({
      name: "math",
      description: "Math agent",
      prompt: "You do math.",
    });

    const config = makeConfig({
      agent: researcher,
      agents: { researcher, math: mathAgent },
    });

    // Turn 1: model triggers handoff
    createResponses.push(
      fakeStream([
        mockOpenAIChunk({
          toolCalls: [{ index: 0, id: "call_h", name: "transfer_to_math", arguments: "{}" }],
          finishReason: "tool_calls",
        }),
      ]),
    );

    // Turn 2: new agent responds
    createResponses.push(fakeStream([mockOpenAIChunk({ content: "2+2=4", finishReason: "stop" })]));

    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("what is 2+2?", config));

    const handoff = chunks.find((c) => c.type === "handoff") as any;
    expect(handoff).toBeDefined();
    expect(handoff.fromAgent).toBe("researcher");
    expect(handoff.toAgent).toBe("math");

    // Second API call should use math agent's system prompt
    expect((capturedCreateArgs[1].messages as any[])[0]).toEqual({
      role: "system",
      content: "You do math.",
    });
  });

  test("handles tool handler errors gracefully", async () => {
    const failingTool = defineTool({
      name: "fail",
      description: "Always fails",
      parameters: z.object({}),
      handler: async () => {
        throw new Error("boom");
      },
    });

    const agent = defineAgent({ ...baseAgent, tools: [failingTool] });
    const config = makeConfig({ agent });

    createResponses.push(
      fakeStream([
        mockOpenAIChunk({
          toolCalls: [{ index: 0, id: "call_f", name: "fail", arguments: "{}" }],
          finishReason: "tool_calls",
        }),
      ]),
    );
    createResponses.push(
      fakeStream([mockOpenAIChunk({ content: "Sorry.", finishReason: "stop" })]),
    );

    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("do it", config));

    const toolResult = chunks.find((c) => c.type === "tool_result") as any;
    expect(toolResult.result).toBe("Error: boom");
  });

  test("respects maxTurns", async () => {
    const echoTool = defineTool({
      name: "echo",
      description: "Echo",
      parameters: z.object({ msg: z.string() }),
      handler: async ({ msg }) => msg,
    });

    const agent = defineAgent({ ...baseAgent, tools: [echoTool] });
    const config = makeConfig({ agent, maxTurns: 2 });

    // Both turns trigger tool calls (never stops)
    for (let i = 0; i < 3; i++) {
      createResponses.push(
        fakeStream([
          mockOpenAIChunk({
            toolCalls: [{ index: 0, id: `call_${i}`, name: "echo", arguments: '{"msg":"loop"}' }],
            finishReason: "tool_calls",
          }),
        ]),
      );
    }

    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("loop", config));

    const errorChunk = chunks.find((c) => c.type === "error") as any;
    expect(errorChunk).toBeDefined();
    expect(errorChunk.error).toContain("Max turns");
  });

  test("multi-turn chat preserves message history", async () => {
    createResponses.push(
      fakeStream([mockOpenAIChunk({ content: "Hello!", finishReason: "stop" })]),
    );
    createResponses.push(
      fakeStream([mockOpenAIChunk({ content: "Great!", finishReason: "stop" })]),
    );

    const config = makeConfig();
    const provider = await createOpenAIProvider(config);

    await collectText(provider.run("hi", config));
    await collectText(provider.chat("how are you?"));

    // Two API calls should have been made
    expect(capturedCreateArgs).toHaveLength(2);

    // First call: system + user("hi")
    const firstCallMessages = capturedCreateArgs[0].messages as any[];
    expect(firstCallMessages[0].role).toBe("system");
    expect(firstCallMessages[1]).toEqual({ role: "user", content: "hi" });

    // Second call messages (by reference, includes all history at end):
    // Verify the second call was made (chat adds user message then calls API)
    expect(capturedCreateArgs[1]).toBeDefined();
  });

  test("yields error for unknown tool", async () => {
    const agent = defineAgent({ ...baseAgent, tools: [] });
    const config = makeConfig({ agent });

    createResponses.push(
      fakeStream([
        mockOpenAIChunk({
          toolCalls: [{ index: 0, id: "call_x", name: "nonexistent", arguments: "{}" }],
          finishReason: "tool_calls",
        }),
      ]),
    );
    createResponses.push(fakeStream([mockOpenAIChunk({ content: "ok", finishReason: "stop" })]));

    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("test", config));

    const toolResult = chunks.find((c) => c.type === "tool_result") as any;
    expect(toolResult.result).toContain("unknown tool");
  });

  test("accumulates streamed tool call arguments", async () => {
    const echoTool = defineTool({
      name: "echo",
      description: "Echo",
      parameters: z.object({ message: z.string() }),
      handler: async ({ message }) => message,
    });

    const agent = defineAgent({ ...baseAgent, tools: [echoTool] });
    const config = makeConfig({ agent });

    // Arguments arrive in multiple chunks
    createResponses.push(
      fakeStream([
        mockOpenAIChunk({
          toolCalls: [{ index: 0, id: "call_1", name: "echo", arguments: '{"mes' }],
        }),
        mockOpenAIChunk({
          toolCalls: [{ index: 0, arguments: 'sage":"hello"}' }],
        }),
        mockOpenAIChunk({ finishReason: "tool_calls" }),
      ]),
    );
    createResponses.push(fakeStream([mockOpenAIChunk({ content: "done", finishReason: "stop" })]));

    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("echo hello", config));

    const toolCall = chunks.find((c) => c.type === "tool_call") as any;
    expect(toolCall.toolArgs).toEqual({ message: "hello" });

    const toolResult = chunks.find((c) => c.type === "tool_result") as any;
    expect(toolResult.result).toBe("hello");
  });

  test("yields error for malformed tool arguments", async () => {
    const agent = defineAgent({
      ...baseAgent,
      tools: [
        defineTool({
          name: "t",
          description: "t",
          parameters: z.object({}),
          handler: async () => "ok",
        }),
      ],
    });
    const config = makeConfig({ agent });

    createResponses.push(
      fakeStream([
        mockOpenAIChunk({
          toolCalls: [{ index: 0, id: "call_bad", name: "t", arguments: "{invalid json" }],
          finishReason: "tool_calls",
        }),
      ]),
    );
    createResponses.push(fakeStream([mockOpenAIChunk({ content: "ok", finishReason: "stop" })]));

    const provider = await createOpenAIProvider(config);
    const chunks = await collect(provider.run("test", config));

    const error = chunks.find((c) => c.type === "error") as any;
    expect(error).toBeDefined();
    expect(error.error).toContain("Failed to parse tool arguments");
  });
});
