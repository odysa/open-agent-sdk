import { z } from "zod";
import { defineAgent, defineTool, run } from "../src/index.js";

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

async function main() {
  console.log("Running claude example...");

  const { stream } = await run("What's the weather in San Francisco?", {
    provider: "claude-code",
    agent,
  });

  for await (const chunk of stream) {
    switch (chunk.type) {
      case "text":
        process.stdout.write(chunk.text);
        break;
      case "tool_call":
        console.log(`\n[tool call] ${chunk.toolName}(${JSON.stringify(chunk.toolArgs)})`);
        break;
      case "tool_result":
        console.log(`[tool result] ${chunk.result}`);
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
