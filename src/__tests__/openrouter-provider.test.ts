import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { defineAgent } from "../agent.js";
import type { RunConfig } from "../types.js";

// --- Mock OpenAI SDK ---

let constructorArgs: Record<string, unknown>[] = [];

mock.module("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: async function* () {
          yield {
            choices: [{ delta: { content: "hi" }, finish_reason: "stop" }],
          };
        },
      },
    };
    constructor(args: Record<string, unknown>) {
      constructorArgs.push(args);
    }
  }
  return { default: MockOpenAI };
});

const { createOpenRouterProvider } = await import("../providers/openrouter.js");

const baseAgent = defineAgent({
  name: "assistant",
  description: "Helper",
  prompt: "You are helpful.",
  model: "anthropic/claude-sonnet-4",
});

let savedApiKey: string | undefined;

beforeEach(() => {
  constructorArgs = [];
  savedApiKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

afterEach(() => {
  if (savedApiKey !== undefined) {
    process.env.OPENROUTER_API_KEY = savedApiKey;
  } else {
    delete process.env.OPENROUTER_API_KEY;
  }
});

describe("OpenRouter provider", () => {
  test("throws if no API key", async () => {
    const config: RunConfig = { provider: "openrouter", agent: baseAgent };
    await expect(createOpenRouterProvider(config)).rejects.toThrow("API key");
  });

  test("throws if no model set", async () => {
    const agent = defineAgent({ ...baseAgent, model: undefined });
    const config: RunConfig = {
      provider: "openrouter",
      agent,
      providerOptions: { apiKey: "sk-or-test" },
    };
    await expect(createOpenRouterProvider(config)).rejects.toThrow("agent.model");
  });

  test("uses OPENROUTER_API_KEY from env", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-env";
    const config: RunConfig = { provider: "openrouter", agent: baseAgent };

    const provider = await createOpenRouterProvider(config);
    expect(provider).toBeDefined();
    expect(constructorArgs[0].apiKey).toBe("sk-or-env");
  });

  test("uses providerOptions.apiKey over env", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-env";
    const config: RunConfig = {
      provider: "openrouter",
      agent: baseAgent,
      providerOptions: { apiKey: "sk-or-explicit" },
    };

    const provider = await createOpenRouterProvider(config);
    expect(provider).toBeDefined();
    expect(constructorArgs[0].apiKey).toBe("sk-or-explicit");
  });

  test("sets baseURL to openrouter.ai", async () => {
    const config: RunConfig = {
      provider: "openrouter",
      agent: baseAgent,
      providerOptions: { apiKey: "sk-or-test" },
    };

    await createOpenRouterProvider(config);
    expect(constructorArgs[0].baseURL).toBe("https://openrouter.ai/api/v1");
  });

  test("passes HTTP-Referer and X-Title headers", async () => {
    const config: RunConfig = {
      provider: "openrouter",
      agent: baseAgent,
      providerOptions: {
        apiKey: "sk-or-test",
        httpReferer: "https://myapp.com",
        xTitle: "My App",
      },
    };

    await createOpenRouterProvider(config);
    const headers = constructorArgs[0].defaultHeaders as Record<string, string>;
    expect(headers["HTTP-Referer"]).toBe("https://myapp.com");
    expect(headers["X-Title"]).toBe("My App");
  });
});
