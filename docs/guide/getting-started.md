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

## Quick Start (Claude)

If you're using Claude, `one-agent-sdk/claude-agent-sdk` is a drop-in replacement for `@anthropic-ai/claude-agent-sdk`:

```typescript
import { z } from "zod";
import { query, tool, createSdkMcpServer } from "one-agent-sdk/claude-agent-sdk";

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

## Quick Start (Provider-Agnostic)

> **Note:** The provider-agnostic API is deprecated and will be removed in v0.2. For Claude, prefer the interface above.

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
  prompt: "You are a helpful assistant. Use the weather tool when asked about weather.",
  tools: [weatherTool],
});

const { stream } = await run("What's the weather in San Francisco?", {
  provider: "claude-code",
  agent,
});

for await (const chunk of stream) {
  if (chunk.type === "text") {
    process.stdout.write(chunk.text);
  }
}
```

## What's Next?

- Learn about [Agents](/guide/agents) and how to configure them
- See how to define [Tools](/guide/tools) with type-safe parameters
- Understand the [Streaming](/guide/streaming) interface
- Build [Multi-Agent Handoffs](/guide/handoffs)
- Compare [Providers](/guide/providers) and register custom ones
- Add [Middleware](/guide/middleware) to transform streams
- Manage [Sessions](/guide/sessions) for multi-turn conversations
- Get typed responses with [Structured Output](/guide/structured-output)
