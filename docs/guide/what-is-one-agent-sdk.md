# What is One Agent SDK?

One Agent SDK is a provider-agnostic TypeScript SDK for building LLM agents with tools and multi-agent handoffs. It exposes a unified streaming interface (`AsyncGenerator<StreamChunk>`) regardless of which backend you choose.

## Why?

Each LLM provider has its own SDK with different APIs, streaming formats, and tool-calling conventions. One Agent SDK abstracts these differences so you can:

- **Write once, run anywhere** — swap providers by changing a single string
- **Use a consistent streaming format** — the same `StreamChunk` union type across all backends
- **Build multi-agent systems** — agents can hand off to each other regardless of provider

## Supported Providers

| Provider | SDK | Coding Agent |
| -------- | --- | ------------ |
| `claude` | `@anthropic-ai/claude-agent-sdk` | Claude Code |
| `codex` | `@openai/codex-sdk` | ChatGPT Codex |
| `kimi` | `@moonshot-ai/kimi-agent-sdk` | Kimi-CLI |

All providers are optional peer dependencies — install only the ones you need.

## How It Works

```
run(prompt, config)
  → dynamically imports the provider
  → returns { stream, chat, close }
```

The `stream` is an `AsyncGenerator<StreamChunk>` that yields events as the agent processes your prompt. The `chat` function lets you send follow-up messages, and `close` cleans up resources.
