# Getting Started

## Installation

Install the SDK with your preferred package manager:

::: code-group

```bash [npm]
npm install one-agent-sdk
```

```bash [pnpm]
pnpm add one-agent-sdk
```

```bash [yarn]
yarn add one-agent-sdk
```

```bash [bun]
bun add one-agent-sdk
```

:::

Then install the provider SDK for your backend:

::: code-group

```bash [Claude]
npm install @anthropic-ai/claude-agent-sdk
```

```bash [Codex]
npm install @openai/codex-sdk
```

```bash [Kimi]
npm install @moonshot-ai/kimi-agent-sdk
```

:::

## Quick Start

`one-agent-sdk` is a drop-in replacement for `@anthropic-ai/claude-agent-sdk`. Same API, multiple providers:

```typescript
import { z } from "zod";
import { query, tool, createSdkMcpServer } from "one-agent-sdk";

// Define a tool (same as @anthropic-ai/claude-agent-sdk)
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

// query() defaults to claude-code — pass options.provider to switch
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

### Switching Providers

Pass `options.provider` to route to a different backend:

```typescript
// Use Codex instead of Claude
const conversation = query({
  prompt: "What's the weather in San Francisco?",
  options: {
    provider: "codex", // "claude-code" (default) | "codex" | "kimi-cli"
    systemPrompt: "You are a helpful assistant.",
  },
});
```

The output stream emits the same `SDKMessage` format regardless of backend.

## What's Next?

- Learn about [Tools](/guide/tools) with type-safe parameters
- Understand the [Streaming](/guide/streaming) interface
- Compare [Providers](/guide/providers) and register custom ones
- Add [Middleware](/guide/middleware) to transform streams
- Manage [Sessions](/guide/sessions) for multi-turn conversations
- Get typed responses with [Structured Output](/guide/structured-output)
