import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineAgent } from "../agent.js";
import { defineTool } from "../tool.js";
import { collect, collectText, createMockProvider } from "./mock-provider.js";

describe("full agent run simulation", () => {
  test("simple text response", async () => {
    const agent = defineAgent({
      name: "assistant",
      description: "Helper",
      prompt: "You are helpful.",
    });

    const { provider } = createMockProvider([
      { type: "text", text: "Hello! How can I help?" },
      { type: "done", text: "Hello! How can I help?" },
    ]);

    const text = await collectText(provider.run("hi", { provider: "claude-code", agent }));
    expect(text).toBe("Hello! How can I help?");
  });

  test("tool call and result flow", async () => {
    const weatherTool = defineTool({
      name: "get_weather",
      description: "Get weather",
      parameters: z.object({ city: z.string() }),
      handler: async ({ city }) => JSON.stringify({ city, temp: 72 }),
    });

    const agent = defineAgent({
      name: "assistant",
      description: "Weather helper",
      prompt: "Use tools for weather.",
      tools: [weatherTool],
    });

    const { provider } = createMockProvider([
      {
        type: "tool_call",
        toolName: "get_weather",
        toolArgs: { city: "SF" },
        toolCallId: "call_1",
      },
      {
        type: "tool_result",
        toolCallId: "call_1",
        result: '{"city":"SF","temp":72}',
      },
      { type: "text", text: "It's 72°F in San Francisco." },
      {
        type: "done",
        text: "It's 72°F in San Francisco.",
        usage: { inputTokens: 50, outputTokens: 30 },
      },
    ]);

    const chunks = await collect(
      provider.run("weather in SF?", { provider: "claude-code", agent }),
    );

    // Verify chunk sequence
    expect(chunks.map((c) => c.type)).toEqual(["tool_call", "tool_result", "text", "done"]);

    // Verify tool call details
    const toolCall = chunks[0];
    if (toolCall.type === "tool_call") {
      expect(toolCall.toolName).toBe("get_weather");
      expect(toolCall.toolArgs).toEqual({ city: "SF" });
    }

    // Verify done has usage
    const done = chunks[3];
    if (done.type === "done") {
      expect(done.usage).toEqual({ inputTokens: 50, outputTokens: 30 });
    }
  });

  test("multi-agent handoff flow", async () => {
    const researcher = defineAgent({
      name: "researcher",
      description: "Research agent",
      prompt: "You research.",
      handoffs: ["math"],
    });

    const mathAgent = defineAgent({
      name: "math",
      description: "Math agent",
      prompt: "You do math.",
      handoffs: ["researcher"],
    });

    const { provider } = createMockProvider([
      { type: "text", text: "Let me hand off to math." },
      { type: "handoff", fromAgent: "researcher", toAgent: "math" },
      { type: "text", text: "2 + 2 = 4" },
      { type: "done", text: "Let me hand off to math. 2 + 2 = 4" },
    ]);

    const chunks = await collect(
      provider.run("what is 2+2?", {
        provider: "claude-code",
        agent: researcher,
        agents: { researcher, math: mathAgent },
      }),
    );

    const handoff = chunks.find((c) => c.type === "handoff");
    expect(handoff).toBeDefined();
    if (handoff?.type === "handoff") {
      expect(handoff.fromAgent).toBe("researcher");
      expect(handoff.toAgent).toBe("math");
    }

    const text = chunks
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("");
    expect(text).toContain("2 + 2 = 4");
  });

  test("error recovery in stream", async () => {
    const agent = defineAgent({
      name: "assistant",
      description: "Helper",
      prompt: "You are helpful.",
    });

    const { provider } = createMockProvider([
      { type: "text", text: "Trying..." },
      { type: "error", error: "Rate limit exceeded" },
      { type: "text", text: "Retried successfully." },
      { type: "done", text: "Trying... Retried successfully." },
    ]);

    const chunks = await collect(provider.run("do something", { provider: "claude-code", agent }));

    expect(chunks.map((c) => c.type)).toEqual(["text", "error", "text", "done"]);
    const error = chunks.find((c) => c.type === "error");
    if (error?.type === "error") {
      expect(error.error).toBe("Rate limit exceeded");
    }
  });

  test("multi-turn chat", async () => {
    const agent = defineAgent({
      name: "assistant",
      description: "Helper",
      prompt: "You are helpful.",
    });

    const mock = createMockProvider([
      { type: "text", text: "Hello!" },
      { type: "done", text: "Hello!" },
    ]);

    // First turn
    const first = await collectText(mock.provider.run("hi", { provider: "claude-code", agent }));
    expect(first).toBe("Hello!");

    // Second turn (chat)
    mock.setEvents([
      { type: "text", text: "I'm doing great!" },
      { type: "done", text: "I'm doing great!" },
    ]);

    const second = await collectText(mock.provider.chat("how are you?"));
    expect(second).toBe("I'm doing great!");

    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0].type).toBe("run");
    expect(mock.calls[1].type).toBe("chat");
  });

  test("multiple tool calls in sequence", async () => {
    const agent = defineAgent({
      name: "assistant",
      description: "Multi-tool agent",
      prompt: "Use tools.",
      tools: [
        defineTool({
          name: "search",
          description: "Search",
          parameters: z.object({ q: z.string() }),
          handler: async ({ q }) => `results for ${q}`,
        }),
        defineTool({
          name: "calculate",
          description: "Calculate",
          parameters: z.object({ expr: z.string() }),
          handler: async ({ expr }) => `result: ${expr}`,
        }),
      ],
    });

    const { provider } = createMockProvider([
      {
        type: "tool_call",
        toolName: "search",
        toolArgs: { q: "population of Tokyo" },
        toolCallId: "call_1",
      },
      { type: "tool_result", toolCallId: "call_1", result: "13.96 million" },
      {
        type: "tool_call",
        toolName: "calculate",
        toolArgs: { expr: "13960000 * 0.15" },
        toolCallId: "call_2",
      },
      { type: "tool_result", toolCallId: "call_2", result: "2094000" },
      { type: "text", text: "15% of Tokyo's population is about 2,094,000." },
      { type: "done", text: "15% of Tokyo's population is about 2,094,000." },
    ]);

    const chunks = await collect(
      provider.run("15% of Tokyo population?", { provider: "claude-code", agent }),
    );

    const toolCalls = chunks.filter((c) => c.type === "tool_call");
    expect(toolCalls).toHaveLength(2);

    const toolResults = chunks.filter((c) => c.type === "tool_result");
    expect(toolResults).toHaveLength(2);

    // Tool call IDs should match between call and result
    if (toolCalls[0].type === "tool_call" && toolResults[0].type === "tool_result") {
      expect(toolCalls[0].toolCallId).toBe(toolResults[0].toolCallId);
    }
  });

  test("close cleans up resources", async () => {
    const mock = createMockProvider();
    expect(mock.closed).toBe(false);
    await mock.provider.close();
    expect(mock.closed).toBe(true);
  });
});
