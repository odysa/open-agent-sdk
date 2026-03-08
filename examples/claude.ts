import { z } from "zod";
import { query, tool, createSdkMcpServer } from "../src/index.js";

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

async function main() {
  console.log("Running claude example...");

  const conversation = query({
    prompt: "What's the weather in San Francisco?",
    options: {
      systemPrompt: "You are a helpful assistant. Use the weather tool when asked about weather.",
      mcpServers: { tools: mcpServer },
      allowedTools: ["mcp__tools__get_weather"],
      maxTurns: 3,
    },
  });

  for await (const msg of conversation) {
    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content) {
        if ("text" in block && block.text) {
          process.stdout.write(block.text);
        }
        if ("type" in block && block.type === "tool_use") {
          console.log(`\n[tool call] ${block.name}(${JSON.stringify(block.input)})`);
        }
      }
    }

    if (msg.type === "result") {
      console.log("\n[done]");
    }
  }
}

main().catch(console.error);
