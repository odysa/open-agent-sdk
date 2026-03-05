# What is One Agent SDK?

One Agent SDK is a provider-agnostic TypeScript SDK for building LLM agents with tools and multi-agent handoffs. It embeds in-process agents — like Claude Code, ChatGPT Codex, and Kimi-CLI — directly into your applications with a unified streaming interface (`AsyncGenerator<StreamChunk>`).

No API keys needed: agents run as local subprocesses using your existing CLI authentication.

## Why?

Each LLM provider has its own SDK with different APIs, streaming formats, and tool-calling conventions. One Agent SDK abstracts these differences so you can:

- **Write once, run anywhere** — swap providers by changing a single string
- **Use a consistent streaming format** — the same `StreamChunk` union type across all backends
- **Build multi-agent systems** — agents can hand off to each other regardless of provider
- **Validate responses** — parse agent output into typed objects with Zod schemas
- **Manage conversations** — session history with pluggable storage backends
- **Transform streams** — composable middleware for logging, filtering, and more

## Supported Providers

| Provider | SDK | Agent Backend |
| -------- | --- | ------------- |
| `claude-code` | `@anthropic-ai/claude-agent-sdk` | Claude Code |
| `codex` | `@openai/codex-sdk` | ChatGPT Codex |
| `kimi-cli` | `@moonshot-ai/kimi-agent-sdk` | Kimi-CLI |

All providers are optional peer dependencies — install only the ones you need. You can also [register custom providers](/guide/providers#custom-providers).

## How It Works

```
run(prompt, config)
  → resolves provider (registry or built-in)
  → applies middleware pipeline
  → returns { stream, chat, close }
```

The `stream` is an `AsyncGenerator<StreamChunk>` that yields events as the agent processes your prompt. The `chat` function lets you send follow-up messages, and `close` cleans up resources.
