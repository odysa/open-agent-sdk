# One Agent SDK

[![npm](https://img.shields.io/npm/v/one-agent-sdk)](https://www.npmjs.com/package/one-agent-sdk)
[![CI](https://github.com/odysa/one-agent-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/odysa/one-agent-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**One SDK for every coding agent.** Run in-process agents powered by Claude Code, ChatGPT Codex, and Kimi-CLI — with a unified streaming interface, type-safe tools, and multi-agent handoffs.

```typescript
const { stream } = await run("What's the weather?", {
  provider: "claude", // swap to "codex" or "kimi" — everything else stays the same
  agent,
});
```

## Why?

Every LLM provider has its own SDK, streaming format, and tool-calling API. You shouldn't have to rewrite your agent for each one.

One Agent SDK gives you:

- **One interface** — `AsyncGenerator<StreamChunk>` across all providers
- **One tool format** — define tools once with Zod, use everywhere
- **One handoff pattern** — multi-agent orchestration that works on any backend
- **Zero API keys** — providers spawn coding agent CLIs as subprocesses

## Providers

| Provider | SDK | Agent |
| -------- | --- | ----- |
| `claude` | `@anthropic-ai/claude-agent-sdk` | Claude Code |
| `codex` | `@openai/codex-sdk` | ChatGPT Codex |
| `kimi` | `@moonshot-ai/kimi-agent-sdk` | Kimi-CLI |

All optional peer dependencies — install only what you need.

## Install

```bash
npm install one-agent-sdk
npm install @anthropic-ai/claude-agent-sdk  # pick your provider
```

## Quick Start

```typescript
import { z } from "zod";
import { defineAgent, defineTool, run } from "one-agent-sdk";

const weatherTool = defineTool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  handler: async ({ city }) => {
    return JSON.stringify({ city, temperature: 72, condition: "sunny" });
  },
});

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant.",
  tools: [weatherTool],
});

const { stream } = await run("What's the weather in San Francisco?", {
  provider: "claude",
  agent,
});

for await (const chunk of stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}
```

## Multi-Agent Handoffs

Agents hand off to each other seamlessly. Define who can talk to whom, and the SDK handles the rest.

```typescript
const researcher = defineAgent({
  name: "researcher",
  description: "Searches the web",
  prompt: "You are a research assistant. Hand off to math for calculations.",
  tools: [searchTool],
  handoffs: ["math"],
});

const math = defineAgent({
  name: "math",
  description: "Evaluates expressions",
  prompt: "You are a math assistant. Hand off to researcher for web searches.",
  tools: [calculatorTool],
  handoffs: ["researcher"],
});

const { stream } = await run("Population of Tokyo? Then calculate 15% of it.", {
  provider: "claude",
  agent: researcher,
  agents: { researcher, math },
});

for await (const chunk of stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
  if (chunk.type === "handoff") console.log(`\n${chunk.fromAgent} -> ${chunk.toAgent}`);
}
```

## Stream Events

| Type | Fields | |
| --- | --- | --- |
| `text` | `text` | Generated text |
| `tool_call` | `toolName`, `toolArgs`, `toolCallId` | Agent calling a tool |
| `tool_result` | `toolCallId`, `result` | Tool returned a result |
| `handoff` | `fromAgent`, `toAgent` | Agent handoff |
| `error` | `error` | Something went wrong |
| `done` | `text?`, `usage?` | Run completed |

## API

| Function | Description |
| --- | --- |
| `run(prompt, config)` | Start a streaming run. Returns `{ stream, chat, close }` |
| `runToCompletion(prompt, config)` | Run and return the final text |
| `defineAgent({...})` | Define an agent |
| `defineTool({...})` | Define a tool with Zod schema |

[Full API docs](https://odysa.github.io/one-agent-sdk/)

## License

MIT
