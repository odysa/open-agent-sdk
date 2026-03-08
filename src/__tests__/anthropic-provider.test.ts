import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { defineAgent } from "../agent.js";
import { defineTool } from "../tool.js";
import type { RunConfig } from "../types.js";
import { collect, collectText } from "./mock-provider.js";

// --- Mock Anthropic SDK ---

type CreateArgs = Record<string, unknown>;
let capturedCreateArgs: CreateArgs[] = [];
let createResponses: AsyncGenerator<any>[] = [];

async function* fakeStream(events: any[]): AsyncGenerator<any> {
  for (const event of events) {
    yield event;
  }
}

function messageStart(inputTokens = 0) {
  return {
    type: "message_start",
    message: { usage: { input_tokens: inputTokens, output_tokens: 0 } },
  };
}

function textBlockStart(index = 0) {
  return {
    type: "content_block_start",
    index,
    content_block: { type: "text", text: "" },
  };
}

function textDelta(text: string) {
  return {
    type: "content_block_delta",
    delta: { type: "text_delta", text },
  };
}

function blockStop() {
  return { type: "content_block_stop" };
}

function toolBlockStart(id: string, name: string, index = 1) {
  return {
    type: "content_block_start",
    index,
    content_block: { type: "tool_use", id, name },
  };
}

function toolInputDelta(partialJson: string) {
  return {
    type: "content_block_delta",
    delta: { type: "input_json_delta", partial_json: partialJson },
  };
}

function messageDelta(stopReason: string, outputTokens = 0) {
  return {
    type: "message_delta",
    delta: { stop_reason: stopReason },
    usage: { input_tokens: 0, output_tokens: outputTokens },
  };
}

mock.module("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: (args: CreateArgs) => {
        capturedCreateArgs.push(args);
        return createResponses.shift();
      },
    };
  }
  return { default: MockAnthropic };
});

const { createAnthropicProvider } = await import("../providers/anthropic.js");

const baseAgent = defineAgent({
  name: "assistant",
  description: "Helper",
  prompt: "You are helpful.",
});

function makeConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return { provider: "anthropic", agent: baseAgent, ...overrides };
}

beforeEach(() => {
  capturedCreateArgs = [];
  createResponses = [];
});

describe("Anthropic provider", () => {
  test("streams text response and yields done with usage", async () => {
    createResponses = [
      fakeStream([
        messageStart(15),
        textBlockStart(),
        textDelta("Hello "),
        textDelta("world!"),
        blockStop(),
        messageDelta("end_turn", 8),
      ]),
    ];

    const config = makeConfig();
    const provider = await createAnthropicProvider(config);
    const chunks = await collect(provider.run("hi", config));

    expect(chunks.map((c) => c.type)).toEqual(["text", "text", "done"]);

    const text = chunks
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toBe("Hello world!");

    const done = chunks.find((c) => c.type === "done") as any;
    expect(done.usage).toEqual({ inputTokens: 15, outputTokens: 8 });
  });

  test("uses default model claude-sonnet-4-20250514", async () => {
    createResponses = [
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("hi"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    ];

    const config = makeConfig();
    const provider = await createAnthropicProvider(config);
    await collect(provider.run("hi", config));

    expect(capturedCreateArgs[0].model).toBe("claude-sonnet-4-20250514");
  });

  test("uses agent.model when set", async () => {
    createResponses = [
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("hi"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    ];

    const agent = defineAgent({ ...baseAgent, model: "claude-opus-4-20250514" });
    const config = makeConfig({ agent });
    const provider = await createAnthropicProvider(config);
    await collect(provider.run("hi", config));

    expect(capturedCreateArgs[0].model).toBe("claude-opus-4-20250514");
  });

  test("passes system prompt as top-level param", async () => {
    createResponses = [
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("hi"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    ];

    const config = makeConfig();
    const provider = await createAnthropicProvider(config);
    await collect(provider.run("hi", config));

    expect(capturedCreateArgs[0].system).toBe("You are helpful.");
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
        messageStart(20),
        toolBlockStart("tu_1", "get_weather", 0),
        toolInputDelta('{"city"'),
        toolInputDelta(':"SF"}'),
        blockStop(),
        messageDelta("tool_use", 10),
      ]),
    );

    // Turn 2: model responds with text
    createResponses.push(
      fakeStream([
        messageStart(30),
        textBlockStart(),
        textDelta("72°F in SF."),
        blockStop(),
        messageDelta("end_turn", 12),
      ]),
    );

    const provider = await createAnthropicProvider(config);
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

    // Turn 1: handoff
    createResponses.push(
      fakeStream([
        messageStart(),
        toolBlockStart("tu_h", "transfer_to_math", 0),
        blockStop(),
        messageDelta("tool_use"),
      ]),
    );

    // Turn 2: math agent responds
    createResponses.push(
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("2+2=4"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    );

    const provider = await createAnthropicProvider(config);
    const chunks = await collect(provider.run("what is 2+2?", config));

    const handoff = chunks.find((c) => c.type === "handoff") as any;
    expect(handoff).toBeDefined();
    expect(handoff.fromAgent).toBe("researcher");
    expect(handoff.toAgent).toBe("math");

    // Second API call should use math agent's system prompt
    expect(capturedCreateArgs[1].system).toBe("You do math.");
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
        messageStart(),
        toolBlockStart("tu_f", "fail", 0),
        blockStop(),
        messageDelta("tool_use"),
      ]),
    );
    createResponses.push(
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("Sorry."),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    );

    const provider = await createAnthropicProvider(config);
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

    for (let i = 0; i < 3; i++) {
      createResponses.push(
        fakeStream([
          messageStart(),
          toolBlockStart(`tu_${i}`, "echo", 0),
          toolInputDelta('{"msg":"loop"}'),
          blockStop(),
          messageDelta("tool_use"),
        ]),
      );
    }

    const provider = await createAnthropicProvider(config);
    const chunks = await collect(provider.run("loop", config));

    const errorChunk = chunks.find((c) => c.type === "error") as any;
    expect(errorChunk).toBeDefined();
    expect(errorChunk.error).toContain("Max turns");
  });

  test("multi-turn chat preserves message history", async () => {
    createResponses.push(
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("Hello!"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    );
    createResponses.push(
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("Great!"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    );

    const config = makeConfig();
    const provider = await createAnthropicProvider(config);

    await collectText(provider.run("hi", config));
    await collectText(provider.chat("how are you?"));

    // Two API calls should have been made
    expect(capturedCreateArgs).toHaveLength(2);

    // First call: just user("hi")
    const firstCallMessages = capturedCreateArgs[0].messages as any[];
    expect(firstCallMessages[0]).toEqual({ role: "user", content: "hi" });

    // Second call was made (chat appends user message then calls API)
    expect(capturedCreateArgs[1]).toBeDefined();
    expect(capturedCreateArgs[1].system).toBe("You are helpful.");
  });

  test("uses maxTokens from providerOptions", async () => {
    createResponses = [
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("hi"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    ];

    const config = makeConfig({ providerOptions: { maxTokens: 4096 } });
    const provider = await createAnthropicProvider(config);
    await collect(provider.run("hi", config));

    expect(capturedCreateArgs[0].max_tokens).toBe(4096);
  });

  test("defaults maxTokens to 8192", async () => {
    createResponses = [
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("hi"),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    ];

    const config = makeConfig();
    const provider = await createAnthropicProvider(config);
    await collect(provider.run("hi", config));

    expect(capturedCreateArgs[0].max_tokens).toBe(8192);
  });

  test("handles text + tool_use in same response", async () => {
    const tool = defineTool({
      name: "calc",
      description: "Calculate",
      parameters: z.object({ expr: z.string() }),
      handler: async ({ expr }) => `result: ${expr}`,
    });

    const agent = defineAgent({ ...baseAgent, tools: [tool] });
    const config = makeConfig({ agent });

    // Response with text first, then tool use
    createResponses.push(
      fakeStream([
        messageStart(),
        textBlockStart(0),
        textDelta("Let me calculate."),
        blockStop(),
        toolBlockStart("tu_c", "calc", 1),
        toolInputDelta('{"expr":"2+2"}'),
        blockStop(),
        messageDelta("tool_use"),
      ]),
    );
    createResponses.push(
      fakeStream([
        messageStart(),
        textBlockStart(),
        textDelta("The answer is 4."),
        blockStop(),
        messageDelta("end_turn"),
      ]),
    );

    const provider = await createAnthropicProvider(config);
    const chunks = await collect(provider.run("calc 2+2", config));

    const types = chunks.map((c) => c.type);
    expect(types).toEqual(["text", "tool_call", "tool_result", "text", "done"]);

    const toolCall = chunks.find((c) => c.type === "tool_call") as any;
    expect(toolCall.toolArgs).toEqual({ expr: "2+2" });
  });
});
