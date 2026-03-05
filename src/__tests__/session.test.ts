import { describe, expect, test } from "bun:test";
import { createSession, MemoryStore } from "../session.js";
import type { AgentDef, AgentRun, RunConfig, StreamChunk } from "../types.js";
import { createMockProvider } from "./mock-provider.js";

const agent: AgentDef = {
  name: "test-agent",
  description: "A test agent",
  prompt: "You are a test assistant.",
};

const baseConfig: RunConfig = {
  provider: "mock" as any,
  agent,
};

function makeMockRunner(events: StreamChunk[]): {
  runner: (prompt: string, config: RunConfig) => Promise<AgentRun>;
  calls: { prompt: string }[];
} {
  const { provider, setEvents, calls } = createMockProvider(events);
  setEvents(events);

  return {
    runner: async (prompt: string, config: RunConfig): Promise<AgentRun> => {
      const stream = provider.run(prompt, config);
      return {
        stream,
        chat: (msg: string) => provider.chat(msg),
        close: () => provider.close(),
      };
    },
    calls: calls as { prompt: string }[],
  };
}

describe("createSession()", () => {
  test("generates a unique ID when none provided", () => {
    const s1 = createSession();
    const s2 = createSession();
    expect(s1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(s1.id).not.toBe(s2.id);
  });

  test("uses provided sessionId", () => {
    const session = createSession({ sessionId: "my-session" });
    expect(session.id).toBe("my-session");
  });
});

describe("MemoryStore", () => {
  test("returns empty array for unknown session", async () => {
    const store = new MemoryStore();
    const messages = await store.load("nonexistent");
    expect(messages).toEqual([]);
  });

  test("saves and loads messages", async () => {
    const store = new MemoryStore();
    const messages = [
      { role: "user" as const, content: "hello" },
      { role: "assistant" as const, content: "hi there" },
    ];
    await store.save("sess1", messages);
    const loaded = await store.load("sess1");
    expect(loaded).toEqual(messages);
  });

  test("store saves a copy (not a reference)", async () => {
    const store = new MemoryStore();
    const messages = [{ role: "user" as const, content: "hello" }];
    await store.save("sess1", messages);
    messages.push({ role: "assistant" as const, content: "mutated" });
    const loaded = await store.load("sess1");
    expect(loaded).toHaveLength(1);
  });

  test("isolates different sessions", async () => {
    const store = new MemoryStore();
    await store.save("a", [{ role: "user", content: "a-message" }]);
    await store.save("b", [{ role: "user", content: "b-message" }]);
    expect(await store.load("a")).toEqual([{ role: "user", content: "a-message" }]);
    expect(await store.load("b")).toEqual([{ role: "user", content: "b-message" }]);
  });
});

describe("session.getHistory()", () => {
  test("returns empty array initially", async () => {
    const session = createSession();
    const history = await session.getHistory();
    expect(history).toEqual([]);
  });
});

describe("session.clear()", () => {
  test("empties conversation history", async () => {
    const store = new MemoryStore();
    await store.save("test", [{ role: "user", content: "hello" }]);
    const session = createSession({ sessionId: "test", store });
    await session.clear();
    expect(await session.getHistory()).toEqual([]);
  });
});

describe("session.run()", () => {
  test("sends prompt without history context on first call", async () => {
    const events: StreamChunk[] = [{ type: "text", text: "Hello!" }, { type: "done" }];
    const { runner, calls } = makeMockRunner(events);
    const session = createSession({ runner });

    const agentRun = await session.run("hi", baseConfig);
    for await (const _ of agentRun.stream) {
      // consume
    }

    expect(calls[0].prompt).toBe("hi");
  });

  test("prepends history context on subsequent calls", async () => {
    const events: StreamChunk[] = [{ type: "text", text: "Hello!" }, { type: "done" }];
    const { runner, calls } = makeMockRunner(events);
    const session = createSession({ runner });

    // First run
    const run1 = await session.run("hi", baseConfig);
    for await (const _ of run1.stream) {
    }

    // Second run
    const run2 = await session.run("how are you?", baseConfig);
    for await (const _ of run2.stream) {
    }

    expect(calls[1].prompt).toContain("Previous conversation:");
    expect(calls[1].prompt).toContain("User: hi");
    expect(calls[1].prompt).toContain("Assistant: Hello!");
    expect(calls[1].prompt).toContain("User: how are you?");
  });

  test("captures assistant text and saves to history after stream completes", async () => {
    const events: StreamChunk[] = [
      { type: "text", text: "Sure, " },
      { type: "text", text: "I can help." },
      { type: "done" },
    ];
    const { runner } = makeMockRunner(events);
    const session = createSession({ runner });

    const agentRun = await session.run("help me", baseConfig);
    for await (const _ of agentRun.stream) {
    }

    const history = await session.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: "user", content: "help me" });
    expect(history[1]).toEqual({ role: "assistant", content: "Sure, I can help." });
  });

  test("does not save assistant message until stream is consumed", async () => {
    const events: StreamChunk[] = [{ type: "text", text: "response" }, { type: "done" }];
    const { runner } = makeMockRunner(events);
    const session = createSession({ runner });

    const agentRun = await session.run("ping", baseConfig);

    // History only has user message before stream is consumed
    const historyBefore = await session.getHistory();
    expect(historyBefore).toHaveLength(1);
    expect(historyBefore[0].role).toBe("user");

    for await (const _ of agentRun.stream) {
    }

    const historyAfter = await session.getHistory();
    expect(historyAfter).toHaveLength(2);
  });

  test("uses custom store", async () => {
    const store = new MemoryStore();
    const events: StreamChunk[] = [{ type: "text", text: "ok" }, { type: "done" }];
    const { runner } = makeMockRunner(events);
    const session = createSession({ sessionId: "custom", store, runner });

    const agentRun = await session.run("test", baseConfig);
    for await (const _ of agentRun.stream) {
    }

    const stored = await store.load("custom");
    expect(stored).toHaveLength(2);
  });
});
