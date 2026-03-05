# Multi-Agent Handoffs

Agents can hand off control to other agents during a conversation. This lets you build systems where specialized agents collaborate to handle complex tasks.

## How It Works

1. An agent declares which agents it can hand off to via the `handoffs` array
2. You provide the full agent definitions in the `agents` map when calling `run()`
3. When the LLM decides to hand off, the SDK swaps the active agent and continues

## Example

```typescript
import { z } from "zod";
import { defineAgent, defineTool, run } from "one-agent-sdk";

const searchTool = defineTool({
  name: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  handler: async ({ query }) => JSON.stringify({ results: [`Result for: ${query}`] }),
});

const calculatorTool = defineTool({
  name: "calculate",
  description: "Evaluate a math expression",
  parameters: z.object({ expression: z.string() }),
  handler: async ({ expression }) => {
    const match = expression.match(/^([\d.]+)\s*([+\-*/])\s*([\d.]+)$/);
    if (!match) return "Error: only simple expressions like '2 + 3' are supported";
    const [, a, op, b] = match;
    const ops: Record<string, (a: number, b: number) => number> = {
      "+": (a, b) => a + b, "-": (a, b) => a - b,
      "*": (a, b) => a * b, "/": (a, b) => a / b,
    };
    return String(ops[op](Number(a), Number(b)));
  },
});

const researcher = defineAgent({
  name: "researcher",
  description: "Research agent that can search the web",
  prompt: "You are a research assistant. Hand off to the math agent for calculations.",
  tools: [searchTool],
  handoffs: ["math"],
});

const mathAgent = defineAgent({
  name: "math",
  description: "Math agent that can evaluate expressions",
  prompt: "You are a math assistant. Hand off to the researcher for web searches.",
  tools: [calculatorTool],
  handoffs: ["researcher"],
});

const { stream } = await run(
  "What is the population of Tokyo? Then calculate 15% of that.",
  {
    provider: "claude-code",
    agent: researcher,
    agents: { researcher, math: mathAgent },
  },
);

for await (const chunk of stream) {
  switch (chunk.type) {
    case "text":
      process.stdout.write(chunk.text);
      break;
    case "handoff":
      console.log(`\n[handoff] ${chunk.fromAgent} -> ${chunk.toAgent}`);
      break;
  }
}
```

## Provider Implementation

Handoffs are implemented differently by each provider, but behave the same from your perspective:

- **Claude** — delegates to the Claude Agent SDK's built-in agent support
- **Codex / Kimi** — handoffs are synthetic `transfer_to_{name}` function tools that swap the system prompt

## The `agents` Map

The `agents` map passed to `run()` must include all agents that could be reached through handoffs:

```typescript
await run(prompt, {
  provider: "claude-code",
  agent: entryAgent,       // The starting agent
  agents: {                // All reachable agents
    entry: entryAgent,
    specialist: specialistAgent,
    reviewer: reviewerAgent,
  },
});
```

Agent names in the `handoffs` array must match keys in the `agents` map.
