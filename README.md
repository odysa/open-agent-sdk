# one-agent-sdk

A provider-agnostic TypeScript SDK for building LLM agents with tools and multi-agent handoffs. Write your agent once, run it on any backend — Claude Code, ChatGPT Codex, Kimi-CLI, and more.

## Supported Providers

| Provider | SDK | Coding Agent |
| -------- | --- | ------------ |
| **claude** | `@anthropic-ai/claude-agent-sdk` | Claude Code |
| **codex** | `@openai/codex-sdk` | ChatGPT Codex |
| **kimi** | `@moonshot-ai/kimi-agent-sdk` | Kimi-CLI |

All providers are optional peer dependencies — install only the ones you need. Each provider spawns the corresponding coding agent CLI as a subprocess, so no API keys are needed.

## Installation

```bash
# npm
npm install one-agent-sdk

# pnpm
pnpm add one-agent-sdk

# yarn
yarn add one-agent-sdk

# bun
bun add one-agent-sdk
```

Then install the provider SDK for your backend:

```bash
# For Claude Code
npm install @anthropic-ai/claude-agent-sdk

# For ChatGPT Codex
npm install @openai/codex-sdk

# For Kimi-CLI
npm install @moonshot-ai/kimi-agent-sdk
```

## Quick Start

```typescript
import { z } from "zod";
import { defineAgent, defineTool, run } from "one-agent-sdk";

// Define a tool
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

// Define an agent
const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant. Use the weather tool when asked about weather.",
  tools: [weatherTool],
});

// Run — swap provider by changing this value
const { stream } = await run("What's the weather in San Francisco?", {
  provider: "claude", // "claude" | "codex" | "kimi"
  agent,
});

for await (const chunk of stream) {
  if (chunk.type === "text") {
    process.stdout.write(chunk.text);
  }
}
```

## Multi-Agent Handoffs

Agents can hand off to each other by declaring `handoffs` and providing an `agents` map:

```typescript
const researcher = defineAgent({
  name: "researcher",
  description: "Research agent that can search the web",
  prompt: "You are a research assistant. If the user needs math help, hand off to the math agent.",
  tools: [searchTool],
  handoffs: ["math"],
});

const mathAgent = defineAgent({
  name: "math",
  description: "Math agent that can evaluate expressions",
  prompt: "You are a math assistant. If the user needs research help, hand off to the researcher.",
  tools: [calculatorTool],
  handoffs: ["researcher"],
});

const { stream } = await run("What is the population of Tokyo? Then calculate 15% of that.", {
  provider: "claude",
  agent: researcher,
  agents: { researcher, math: mathAgent },
});

for await (const chunk of stream) {
  switch (chunk.type) {
    case "text":
      process.stdout.write(chunk.text);
      break;
    case "handoff":
      console.log(`[handoff] ${chunk.fromAgent} -> ${chunk.toAgent}`);
      break;
  }
}
```

## API Reference

### `run(prompt, config): Promise<AgentRun>`

Starts a streaming agent run.

- **`prompt`** — the user message
- **`config.provider`** — `"claude"` | `"codex"` | `"kimi"`
- **`config.agent`** — the agent definition
- **`config.agents`** — map of agent names to definitions (for handoffs)
- **`config.maxTurns`** — limit tool-use turns
- **`config.signal`** — `AbortSignal` for cancellation

Returns `{ stream, chat, close }`:

- **`stream`** — `AsyncGenerator<StreamChunk>` of events
- **`chat(message)`** — send a follow-up message, returns a new stream
- **`close()`** — clean up resources

### `runToCompletion(prompt, config): Promise<string>`

Convenience wrapper that collects all text chunks and returns the final string.

### `defineTool({ name, description, parameters, handler })`

Helper to define a tool with a Zod schema for type-safe parameters.

### `defineAgent({ name, description, prompt, tools?, handoffs?, model?, mcpServers? })`

Helper to define an agent.

### Stream Chunks

The stream yields a discriminated union (`StreamChunk`):

| Type          | Fields                                    |
| ------------- | ----------------------------------------- |
| `text`        | `text`                                    |
| `tool_call`   | `toolName`, `toolArgs`, `toolCallId`      |
| `tool_result` | `toolCallId`, `result`                    |
| `handoff`     | `fromAgent`, `toAgent`                    |
| `error`       | `error`                                   |
| `done`        | `text?`, `usage?`                         |

## License

MIT
