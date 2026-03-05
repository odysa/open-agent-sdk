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
  provider: "claude-code", // "claude-code" | "codex" | "kimi-cli"
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
