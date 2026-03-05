# One Agent SDK

[![npm version](https://img.shields.io/npm/v/one-agent-sdk)](https://www.npmjs.com/package/one-agent-sdk)
[![CI](https://github.com/odysa/one-agent-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/odysa/one-agent-sdk/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**One SDK for every coding agent.** Build LLM-powered agents once and run them on any backend — no more rewriting your tools, streaming logic, or handoff code when you switch between Claude Code, ChatGPT Codex, and Kimi-CLI. Define agents and tools with a single TypeScript API, and swap providers with one line.

```typescript
const { stream } = await run("What's the weather?", {
  provider: "claude", // swap to "codex" or "kimi" — same code, different backend
  agent,
});
```

## Why?

Every LLM provider ships its own SDK with different streaming formats, tool-calling APIs, and agent patterns. One Agent SDK abstracts these differences so you can:

- **Write once, run anywhere** — swap providers by changing a single string
- **Define tools once** — Zod schemas that work across all backends
- **Orchestrate agents** — multi-agent handoffs that work on any provider
- **Skip the API keys** — providers run coding agent CLIs as in-process subprocesses

## Supported providers

| Provider | SDK | Agent Backend |
| -------- | --- | ------------- |
| `claude` | [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) | Claude Code |
| `codex` | [`@openai/codex-sdk`](https://www.npmjs.com/package/@openai/codex-sdk) | ChatGPT Codex |
| `kimi` | [`@moonshot-ai/kimi-agent-sdk`](https://www.npmjs.com/package/@moonshot-ai/kimi-agent-sdk) | Kimi-CLI |

All providers are **optional peer dependencies** — install only what you need. You can also [register custom providers](#custom-providers).

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ or [Bun](https://bun.sh/)
- At least one provider CLI installed and authenticated (e.g. Claude Code)

### Installation

Install the SDK:

```bash
npm install one-agent-sdk
# or
pnpm add one-agent-sdk
# or
bun add one-agent-sdk
```

Then install the provider SDK for your backend:

```bash
# Pick one (or more)
npm install @anthropic-ai/claude-agent-sdk
npm install @openai/codex-sdk
npm install @moonshot-ai/kimi-agent-sdk
```

### Quick start

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

> [!TIP]
> To switch providers, just change `provider: "claude"` to `"codex"` or `"kimi"`. Everything else stays the same.

## Features

### Multi-agent handoffs

Agents can hand off tasks to each other. Define who can talk to whom, and the SDK handles routing across all providers.

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
  prompt: "You are a math assistant.",
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

### Structured output

`runToCompletion` accepts a `responseSchema` to parse and validate the agent's response against a Zod schema:

```typescript
import { z } from "zod";
import { runToCompletion } from "one-agent-sdk";

const City = z.object({
  name: z.string(),
  country: z.string(),
  population: z.number(),
});

const city = await runToCompletion("Give me info about Tokyo as JSON.", {
  provider: "claude",
  agent,
  responseSchema: City,
});
// city is typed as { name: string; country: string; population: number }
```

### Sessions

`createSession` manages multi-turn conversation history, with pluggable storage backends:

```typescript
import { createSession } from "one-agent-sdk";

const session = createSession();

const first = await session.run("My name is Alice.", { provider: "claude", agent });
for await (const chunk of first.stream) { /* ... */ }

// The agent remembers the previous turn
const second = await session.run("What's my name?", { provider: "claude", agent });
for await (const chunk of second.stream) { /* ... */ }
```

Implement the `SessionStore` interface to persist history to a database or file system.

### Middleware

Transform the stream between the provider and your application with composable middleware:

```typescript
import { defineMiddleware, run } from "one-agent-sdk";

const logger = defineMiddleware(async function* (stream, context) {
  for await (const chunk of stream) {
    if (chunk.type === "text") console.log(`[${context.provider}]`, chunk.text);
    yield chunk;
  }
});

const { stream } = await run("Hello", {
  provider: "claude",
  agent,
  middleware: [logger],
});
```

### Custom providers

Register your own provider backend with `registerProvider`:

```typescript
import { registerProvider, run } from "one-agent-sdk";

registerProvider("my-llm", async (config) => {
  // Return a ProviderBackend: { run, chat, close }
  return {
    async *run(prompt) { yield { type: "text", text: "Hello from my-llm!" }; yield { type: "done" }; },
    async *chat(msg) { yield { type: "text", text: msg }; yield { type: "done" }; },
    async close() {},
  };
});

const { stream } = await run("Hi", { provider: "my-llm", agent });
```

## Stream events

All providers emit the same `StreamChunk` discriminated union:

| Type | Fields | Description |
| --- | --- | --- |
| `text` | `text` | Generated text delta |
| `tool_call` | `toolName`, `toolArgs`, `toolCallId` | Agent is calling a tool |
| `tool_result` | `toolCallId`, `result` | Tool returned a result |
| `handoff` | `fromAgent`, `toAgent` | Agent handoff occurred |
| `error` | `error` | Something went wrong |
| `done` | `text?`, `usage?` | Run completed |

## API reference

| Function | Description |
| --- | --- |
| `run(prompt, config)` | Start a streaming agent run. Returns `{ stream, chat, close }` |
| `runToCompletion(prompt, config)` | Run and return the final text (or validated object with `responseSchema`) |
| `defineAgent({...})` | Define an agent with prompt, tools, and handoffs |
| `defineTool({...})` | Define a type-safe tool with Zod schema |
| `defineMiddleware(fn)` | Create a stream middleware |
| `createSession(config?)` | Create a session for multi-turn conversations |
| `registerProvider(name, factory)` | Register a custom provider backend |

`run()` returns an `AgentRun` handle:

- **`stream`** — `AsyncGenerator<StreamChunk>` yielding events as they happen
- **`chat(message)`** — send a follow-up message, returns a new stream
- **`close()`** — clean up resources

For full API documentation, see the [docs site](https://odysa.github.io/one-agent-sdk/).

## Examples

The [`examples/`](./examples) directory contains runnable demos:

| Example | Description |
| --- | --- |
| [`hello.ts`](./examples/hello.ts) | Minimal agent, no tools |
| [`multi-agent.ts`](./examples/multi-agent.ts) | Two agents handing off to each other |
| [`claude.ts`](./examples/claude.ts) | Claude-specific example |
| [`codex.ts`](./examples/codex.ts) | Codex-specific example |
| [`kimi.ts`](./examples/kimi.ts) | Kimi-specific example |

Run any example with:

```bash
npx tsx examples/hello.ts
```

## How it works

```
run(prompt, config)
  → resolves provider (registry or built-in)
  → applies middleware pipeline
  → returns { stream, chat, close }
```

Each provider adapts its native SDK to the unified `StreamChunk` interface:

- **Claude** — wraps the Claude Agent SDK. Tools are exposed via an in-process MCP server.
- **Codex** — wraps the Codex SDK. Zod schemas are converted to JSON Schema automatically.
- **Kimi** — wraps the Kimi Agent SDK. Uses `createSession`/`createExternalTool`.

Handoffs work differently per provider but produce identical `handoff` stream events. Claude uses its SDK's built-in agent support, while Codex and Kimi use synthetic `transfer_to_{name}` tools.

> [!NOTE]
> Provider SDKs are dynamically imported at runtime, so unused providers are never loaded.
