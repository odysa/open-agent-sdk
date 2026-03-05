import { afterEach, describe, expect, test } from "bun:test";
import { clearProviders, getProvider, registerProvider } from "../registry.js";
import { run } from "../runner.js";
import type { AgentDef } from "../types.js";
import { createMockProvider } from "./mock-provider.js";

const agent: AgentDef = {
  name: "test-agent",
  description: "A test agent",
  prompt: "You are a test assistant.",
};

afterEach(() => {
  clearProviders();
});

describe("registerProvider / getProvider", () => {
  test("registerProvider makes a custom provider available", () => {
    const { provider } = createMockProvider();
    registerProvider("my-llm", async () => provider);
    expect(getProvider("my-llm")).toBeDefined();
  });

  test("getProvider returns undefined for unknown name", () => {
    expect(getProvider("unknown")).toBeUndefined();
  });

  test("clearProviders removes all registered providers", () => {
    const { provider } = createMockProvider();
    registerProvider("a", async () => provider);
    registerProvider("b", async () => provider);
    clearProviders();
    expect(getProvider("a")).toBeUndefined();
    expect(getProvider("b")).toBeUndefined();
  });

  test("custom provider overrides built-in if same name is used", async () => {
    const { provider, calls } = createMockProvider([{ type: "done" }]);
    registerProvider("claude", async () => provider);
    const handle = await run("hello", { provider: "claude", agent });
    for await (const _ of handle.stream) {
      // drain
    }
    expect(calls.length).toBe(1);
    await handle.close();
  });
});

describe("run() with registered provider", () => {
  test("uses custom provider when its name is given", async () => {
    const { provider, calls } = createMockProvider([
      { type: "text", text: "hello from mock" },
      { type: "done" },
    ]);
    registerProvider("custom-provider", async () => provider);

    const handle = await run("hi", { provider: "custom-provider", agent });
    const chunks: string[] = [];
    for await (const chunk of handle.stream) {
      if (chunk.type === "text") chunks.push(chunk.text);
    }
    await handle.close();

    expect(calls.length).toBe(1);
    expect(calls[0].prompt).toBe("hi");
    expect(chunks).toEqual(["hello from mock"]);
  });

  test("unknown provider throws helpful error", async () => {
    await expect(run("hello", { provider: "no-such-provider", agent })).rejects.toThrow(
      "Unknown provider: no-such-provider",
    );
    await expect(run("hello", { provider: "no-such-provider", agent })).rejects.toThrow(
      "registerProvider()",
    );
  });

  test("built-in provider names remain valid type-level values", () => {
    // This is a compile-time check — just ensure the type assignment works
    const p1: import("../types.js").BuiltinProvider = "claude";
    const p2: import("../types.js").BuiltinProvider = "codex";
    const p3: import("../types.js").BuiltinProvider = "kimi";
    expect([p1, p2, p3]).toEqual(["claude", "codex", "kimi"]);
  });
});
