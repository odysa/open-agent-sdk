import { z } from "zod";
import { defineAgent, defineTool, run } from "../src/index.js";

// --- Tools ---

const searchTool = defineTool({
  name: "search",
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("Search query"),
  }),
  handler: async ({ query }) => {
    return JSON.stringify({
      results: [
        { title: `Result for "${query}"`, snippet: "Mock search result content." },
      ],
    });
  },
});

const calculatorTool = defineTool({
  name: "calculate",
  description: "Evaluate a math expression",
  parameters: z.object({
    expression: z.string().describe("Math expression to evaluate"),
  }),
  handler: async ({ expression }) => {
    try {
      // Simple eval for demo purposes
      const result = Function(`"use strict"; return (${expression})`)();
      return String(result);
    } catch {
      return "Error: could not evaluate expression";
    }
  },
});

// --- Agents ---

const researcher = defineAgent({
  name: "researcher",
  description: "Research agent that can search the web",
  prompt: "You are a research assistant. Use the search tool to find information. If the user needs math help, hand off to the math agent.",
  tools: [searchTool],
  handoffs: ["math"],
});

const mathAgent = defineAgent({
  name: "math",
  description: "Math agent that can evaluate expressions",
  prompt: "You are a math assistant. Use the calculator tool to evaluate expressions. If the user needs research help, hand off to the researcher.",
  tools: [calculatorTool],
  handoffs: ["researcher"],
});

// --- Run ---

async function main() {
  const { stream } = await run(
    "What is the population of Tokyo? Then calculate what 15% of that number is.",
    {
      provider: "claude",
      agent: researcher,
      agents: {
        researcher,
        math: mathAgent,
      },
    }
  );

  for await (const chunk of stream) {
    switch (chunk.type) {
      case "text":
        process.stdout.write(chunk.text);
        break;
      case "tool_call":
        console.log(`\n[tool: ${chunk.toolName}] ${JSON.stringify(chunk.toolArgs)}`);
        break;
      case "tool_result":
        console.log(`[result] ${chunk.result}`);
        break;
      case "handoff":
        console.log(`\n[handoff] ${chunk.fromAgent} -> ${chunk.toAgent}`);
        break;
      case "done":
        console.log("\n[done]");
        break;
      case "error":
        console.error(`[error] ${chunk.error}`);
        break;
    }
  }
}

main().catch(console.error);
