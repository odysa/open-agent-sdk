import { defineAgent, run } from "../src/index.js";

const agent = defineAgent({
  name: "assistant",
  description: "A helpful coding assistant",
  prompt: "You are a helpful coding assistant.",
});

async function main() {
  console.log("Running copilot example...");

  const { stream, close } = await run("List the files in the current directory", {
    provider: "copilot",
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
        if (chunk.usage) {
          console.log(`[usage] input: ${chunk.usage.inputTokens}, output: ${chunk.usage.outputTokens}`);
        }
        break;
      case "error":
        console.error(`[error] ${chunk.error}`);
        break;
    }
  }

  await close();
}

main().catch(console.error);
