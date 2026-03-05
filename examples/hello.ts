import { defineAgent, run } from "../src/index.js";

const agent = defineAgent({
  name: "assistant",
  description: "A friendly assistant",
  prompt: "You are a friendly assistant. Keep responses brief.",
});

async function main() {
  const provider = (process.argv[2] as "claude-code" | "codex" | "kimi-cli") ?? "claude-code";

  console.log(`Running hello example with provider: ${provider}...`);

  const { stream } = await run("Say hello and introduce yourself in one sentence.", {
    provider,
    agent,
  });

  for await (const chunk of stream) {
    if (chunk.type === "text") {
      process.stdout.write(chunk.text);
    }
  }
  console.log();
}

main().catch(console.error);
