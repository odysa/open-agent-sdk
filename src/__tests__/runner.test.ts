import { describe, expect, test } from "bun:test";
import { run, runToCompletion } from "../runner.js";
import type { AgentDef } from "../types.js";

const agent: AgentDef = {
  name: "test-agent",
  description: "A test agent",
  prompt: "You are a test assistant.",
};

describe("run()", () => {
  test("rejects unknown provider with helpful message", async () => {
    await expect(run("hello", { provider: "invalid" as any, agent })).rejects.toThrow(
      "Unknown provider",
    );
  });
});

describe("runToCompletion()", () => {
  test("rejects unknown provider", async () => {
    await expect(runToCompletion("hello", { provider: "invalid" as any, agent })).rejects.toThrow(
      "Unknown provider",
    );
  });
});
