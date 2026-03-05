#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const PROVIDERS = {
  "claude-code": "@anthropic-ai/claude-agent-sdk",
  codex: "@openai/codex-sdk",
  "kimi-cli": "@moonshot-ai/kimi-agent-sdk",
};

const PROVIDER_LABELS = {
  "claude-code": "Claude Code",
  codex: "ChatGPT Codex",
  "kimi-cli": "Kimi CLI",
};

async function main() {
  // Accept project name as positional arg or prompt
  let name = process.argv[2];

  console.log();
  console.log("  Create One Agent");
  console.log("  ~~~~~~~~~~~~~~~~");
  console.log();

  if (!name) {
    name = (await ask("  Project name (my-agent): ")).trim() || "my-agent";
  }

  console.log();
  console.log("  Providers:");
  console.log("    1. claude-code  (Claude Code)");
  console.log("    2. codex        (ChatGPT Codex)");
  console.log("    3. kimi-cli     (Kimi CLI)");
  console.log();

  const choice = (await ask("  Choose provider [1]: ")).trim() || "1";
  const provider =
    ["claude-code", "codex", "kimi-cli"][Number(choice) - 1] || "claude-code";
  const providerPkg = PROVIDERS[provider];

  rl.close();

  const dir = resolve(process.cwd(), name);
  await mkdir(dir, { recursive: true });

  // package.json
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: basename(name),
        version: "0.1.0",
        type: "module",
        private: true,
        scripts: {
          start: "npx tsx index.ts",
        },
        dependencies: {
          "one-agent-sdk": "^0.1.5",
          [providerPkg]: "latest",
          zod: "^4.0.0",
        },
      },
      null,
      2,
    ) + "\n",
  );

  // index.ts
  await writeFile(
    join(dir, "index.ts"),
    `import { z } from "zod";
import { defineAgent, defineTool, run } from "one-agent-sdk";

const weatherTool = defineTool({
  name: "get_weather",
  description: "Get current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  handler: async ({ city }) => {
    return JSON.stringify({ city, temp: 72, condition: "sunny" });
  },
});

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant. Use tools when needed.",
  tools: [weatherTool],
});

const { stream } = await run("What's the weather in San Francisco?", {
  provider: "${provider}",
  agent,
});

for await (const chunk of stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}
console.log();
`,
  );

  // tsconfig.json (minimal, for editor support)
  await writeFile(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "Node16",
          moduleResolution: "Node16",
          strict: true,
          skipLibCheck: true,
        },
      },
      null,
      2,
    ) + "\n",
  );

  console.log();
  console.log(`  Done! Created ${name}/`);
  console.log();
  console.log(`    cd ${name}`);
  console.log("    npm install");
  console.log("    npm start");
  console.log();
  console.log(
    `  Using ${PROVIDER_LABELS[provider]} — make sure its CLI is installed and authenticated.`,
  );
  console.log(
    "  To switch providers, just change the provider string in index.ts.",
  );
  console.log();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
