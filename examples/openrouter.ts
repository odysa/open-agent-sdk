import { z } from "zod";
import { defineAgent, defineTool, run } from "../src/index.js";

const weatherTool = defineTool({
  name: "get_weather",
  description: "Get the current weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
  }),
  handler: async ({ location }) => {
    return JSON.stringify({ location, temperature: "72°F", condition: "sunny" });
  },
});

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant with weather tools",
  prompt: "You are a helpful assistant. Use the get_weather tool when asked about weather. Keep responses brief.",
  tools: [weatherTool],
  model: "anthropic/claude-sonnet-4", // OpenRouter requires model to be set
});

async function main() {
  console.log("Running OpenRouter example...");

  const { stream } = await run("What's the weather in San Francisco?", {
    provider: "openrouter",
    agent,
    // providerOptions: { apiKey: "sk-or-..." }, // or set OPENROUTER_API_KEY env var
  });

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
      case "done":
        console.log("\n[done]");
        if (chunk.usage) {
          console.log(`[usage] input: ${chunk.usage.inputTokens}, output: ${chunk.usage.outputTokens}`);
        }
        break;
      case "error":
        console.error(`[error] ${chunk.error}`);
        break;
    }
  }
}

main().catch(console.error);
