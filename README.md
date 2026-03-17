<div align="center">

<picture>
  <img src="./assets/banner.svg" alt="One Agent SDK" width="100%" />
</picture>

<br />

[![npm version](https://img.shields.io/npm/v/one-agent-sdk?style=flat-square&color=cb3837&label=npm)](https://www.npmjs.com/package/one-agent-sdk)
[![CI](https://img.shields.io/github/actions/workflow/status/odysa/one-agent-sdk/ci.yml?style=flat-square&label=CI)](https://github.com/odysa/one-agent-sdk/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](https://opensource.org/licenses/MIT)
[![Python SDK](https://img.shields.io/badge/Python_SDK-3776AB?style=flat-square&logo=python&logoColor=white)](https://github.com/odysa/one-agent-sdk-python)

**Drop-in replacement for `@anthropic-ai/claude-agent-sdk` — same API, multiple providers.**

<br />

[Getting Started](#getting-started) · [Features](#features) · [Providers](#supported-providers) · [API Reference](#api-reference) · [Examples](#examples)

<br />

</div>

```typescript
import { query, tool, createSdkMcpServer } from "one-agent-sdk";

// Same API as @anthropic-ai/claude-agent-sdk — swap provider with one option
const conversation = query({
  prompt: "What's the weather?",
  options: { provider: "codex" }, // or "openai", "anthropic", "openrouter", ...
});
```

<br />

## The Problem

`@anthropic-ai/claude-agent-sdk` has a great API — but it only works with Claude Code. If you want to use Codex or Kimi, you have to learn a completely different SDK.

## The Solution

One Agent SDK is a drop-in replacement for `@anthropic-ai/claude-agent-sdk` that routes to any backend. Same `query()`, `tool()`, `createSdkMcpServer()` — just pass `options.provider` to switch:

```diff
  const conversation = query({
    prompt: "Analyze this code",
-   options: { systemPrompt: "You are helpful." },
+   options: { systemPrompt: "You are helpful.", provider: "codex" },
  });
```

Everything else stays the same: streaming, tools, message format — all of it.

<br />

## Supported Providers

### CLI Agent Providers

These wrap CLI agent SDKs — no API keys needed, agents run as local subprocesses using your existing CLI authentication.

| Provider | Package | Agent Backend |
| :------- | :------ | :------------ |
| `claude-code` | [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) | Claude Code |
| `codex` | [`@openai/codex-sdk`](https://www.npmjs.com/package/@openai/codex-sdk) | ChatGPT Codex |
| `copilot` | [`@github/copilot-sdk`](https://www.npmjs.com/package/@github/copilot-sdk) | GitHub Copilot |
| `kimi-cli` | [`@moonshot-ai/kimi-agent-sdk`](https://www.npmjs.com/package/@moonshot-ai/kimi-agent-sdk) | Kimi-CLI |
| `gemini-cli` | `@google/gemini-cli-core` | Gemini CLI (planned — pending stable SDK, see [#31](https://github.com/odysa/one-agent-sdk/issues/31)) |

### API-Key Providers

These call LLM HTTP APIs directly with API keys — no CLI tooling required.

| Provider | Package | API Backend |
| :------- | :------ | :---------- |
| `openai` | [`openai`](https://www.npmjs.com/package/openai) | OpenAI API (GPT-4o, etc.) |
| `anthropic` | [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) | Anthropic API (Claude Sonnet, etc.) |
| `openrouter` | [`openai`](https://www.npmjs.com/package/openai) | [OpenRouter](https://openrouter.ai/) (any model) |

All providers are **optional peer dependencies** — install only what you need. You can also [register custom providers](#custom-providers).

<br />

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ or [Bun](https://bun.sh/)
- At least one provider: either a CLI agent SDK installed and authenticated, or an API key

### Install

```bash
npm install one-agent-sdk
```

Then install your provider:

```bash
# CLI agent providers (pick one or more)
npm install @anthropic-ai/claude-agent-sdk
npm install @openai/codex-sdk
npm install @github/copilot-sdk
npm install @moonshot-ai/kimi-agent-sdk

# API-key providers (pick one or more)
npm install openai              # for "openai" or "openrouter" provider
npm install @anthropic-ai/sdk   # for "anthropic" provider
```

### Quick Start

```typescript
import { z } from "zod";
import { query, tool, createSdkMcpServer } from "one-agent-sdk";

const weatherTool = tool(
  "get_weather",
  "Get the current weather for a city",
  { city: z.string().describe("City name") },
  async ({ city }) => ({
    content: [{ type: "text" as const, text: JSON.stringify({ city, temperature: 72, condition: "sunny" }) }],
  }),
);

const mcpServer = createSdkMcpServer({
  name: "tools",
  version: "1.0.0",
  tools: [weatherTool],
});

const conversation = query({
  prompt: "What's the weather in San Francisco?",
  options: {
    systemPrompt: "You are a helpful assistant. Use the weather tool when asked about weather.",
    mcpServers: { tools: mcpServer },
    allowedTools: ["mcp__tools__get_weather"],
  },
});

for await (const msg of conversation) {
  if (msg.type === "assistant" && msg.message?.content) {
    for (const block of msg.message.content) {
      if ("text" in block && block.text) process.stdout.write(block.text);
    }
  }
}
```

> [!TIP]
> To switch providers, add `provider: "codex"`, `provider: "openai"`, etc. to `options`. Defaults to `"claude-code"`.

<br />

## Features

### Multi-Provider Support

Same code, different backend — just change `options.provider`:

```typescript
import { query } from "one-agent-sdk";

// Use Claude (default)
const claude = query({ prompt: "Explain this code" });

// Use Codex
const codex = query({ prompt: "Explain this code", options: { provider: "codex" } });

// Use OpenAI API directly
const openai = query({ prompt: "Explain this code", options: { provider: "openai" } });

// Use Anthropic API directly
const anthropic = query({ prompt: "Explain this code", options: { provider: "anthropic" } });

// Use any model via OpenRouter
const openrouter = query({ prompt: "Explain this code", options: { provider: "openrouter", model: "anthropic/claude-sonnet-4" } });
```

The output stream always emits the same `SDKMessage` format, regardless of provider.

### Custom Providers

Register your own provider backend and use it with `query()`:

```typescript
import { registerProvider } from "one-agent-sdk";
import { query } from "one-agent-sdk";

registerProvider("my-llm", async (config) => ({
  async *run(prompt) {
    yield { type: "text", text: "Hello from my-llm!" };
    yield { type: "done" };
  },
  async *chat(msg) {
    yield { type: "text", text: msg };
    yield { type: "done" };
  },
  async close() {},
}));

const conversation = query({ prompt: "Hi", options: { provider: "my-llm" } });
```

<br />

## How It Works

```mermaid
graph LR
    A["query(prompt, options)"] --> B{options.provider}
    B -->|claude-code| C["@anthropic-ai/claude-agent-sdk"]
    B -->|codex| D["@openai/codex-sdk"]
    B -->|copilot| E["@github/copilot-sdk"]
    B -->|kimi-cli| F["@moonshot-ai/kimi-agent-sdk"]
    B -->|openai| G["OpenAI API"]
    B -->|anthropic| H["Anthropic API"]
    B -->|openrouter| I["OpenRouter API"]
    B -->|custom| J[Registered Provider]
    C --> K[SDKMessage Stream]
    D --> K
    E --> K
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K
```

- **`claude-code`** (default) — delegates directly to the real Anthropic SDK. Full fidelity, zero overhead.
- **CLI providers** (`codex`, `copilot`, `kimi-cli`) — wraps CLI agent SDKs, adapts output to `SDKMessage` format.
- **API providers** (`openai`, `anthropic`, `openrouter`) — calls LLM APIs directly with API keys, manages multi-turn tool loops internally.

> [!NOTE]
> Provider SDKs are dynamically imported at runtime — unused providers are never loaded.

<br />

## API Reference

```typescript
import { query, tool, createSdkMcpServer } from "one-agent-sdk";
```

100% API-compatible with `@anthropic-ai/claude-agent-sdk`. All exports are identical — see the [Anthropic Agent SDK docs](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) for the full reference.

**Added by One Agent SDK:**

| Option | Description |
| :------- | :---------- |
| `options.provider` | Route to a different backend: `"claude-code"` (default), `"codex"`, `"copilot"`, `"kimi-cli"`, `"openai"`, `"anthropic"`, `"openrouter"`, or any registered custom provider |

| Helper | Description |
| :------- | :---------- |
| `registerProvider(name, factory)` | Register a custom provider backend (import from `one-agent-sdk`) |

For full API documentation, see the [docs site](https://odysa.github.io/one-agent-sdk/).

<br />

## Examples

The [`examples/`](./examples) directory contains runnable demos:

| Example | Description |
| :------ | :---------- |
| [`claude.ts`](./examples/claude.ts) | Claude with tools via `query()` + `tool()` |
| [`codex.ts`](./examples/codex.ts) | Codex backend |
| [`copilot.ts`](./examples/copilot.ts) | GitHub Copilot backend |
| [`kimi.ts`](./examples/kimi.ts) | Kimi backend |
| [`openai-api.ts`](./examples/openai-api.ts) | OpenAI API with tools |
| [`anthropic-api.ts`](./examples/anthropic-api.ts) | Anthropic API with tools |
| [`openrouter.ts`](./examples/openrouter.ts) | OpenRouter (any model) |
| [`hello.ts`](./examples/hello.ts) | Minimal example (legacy API) |
| [`multi-agent.ts`](./examples/multi-agent.ts) | Multi-agent handoffs (legacy API) |

```bash
npx tsx examples/hello.ts
```

<br />

## Legacy API (Deprecated)

The following functions are exported from `one-agent-sdk` and will be removed in v0.2. Migrate to `one-agent-sdk` instead.

| Function | Replacement |
| :------- | :---------- |
| `run(prompt, config)` | `query({ prompt, options })` |
| `runToCompletion(prompt, config)` | `query({ prompt, options })` + collect results |
| `defineAgent({...})` | Pass agent config directly via `query()` options |
| `defineTool({...})` | `tool(name, description, schema, handler)` |

<br />

## Python SDK

Looking for Python? See **[one-agent-sdk-python](https://github.com/odysa/one-agent-sdk-python)** — same API, same providers, pure Python.

```bash
pip install one-agent-sdk
```

```python
from one_agent_sdk import query, ClaudeAgentOptions

async for msg in query(prompt="Hello", options=ClaudeAgentOptions(provider="codex")):
    print(msg)
```

<br />

## Contributing

Contributions are welcome! Please see the [contributing guide](CONTRIBUTING.md) for details.

<br />

## License

[MIT](LICENSE)
