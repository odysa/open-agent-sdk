import type { ProviderBackend } from "./providers/types.js";
import type { AgentRun, RunConfig } from "./types.js";

async function createProvider(config: RunConfig): Promise<ProviderBackend> {
  switch (config.provider) {
    case "claude": {
      const { createClaudeProvider } = await import("./providers/claude.js");
      return createClaudeProvider(config);
    }
    case "openai": {
      const { createOpenAIProvider } = await import("./providers/openai.js");
      return createOpenAIProvider(config);
    }
    case "kimi": {
      const { createKimiProvider } = await import("./providers/kimi.js");
      return createKimiProvider(config);
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}. Use: claude, openai, kimi`);
  }
}

/** Start a run — returns a stream, chat handle, and close function */
export async function run(prompt: string, config: RunConfig): Promise<AgentRun> {
  const provider = await createProvider(config);
  const stream = provider.run(prompt, config);

  return {
    stream,
    chat: (message: string) => provider.chat(message),
    close: () => provider.close(),
  };
}

/** Convenience: run to completion and return collected text */
export async function runToCompletion(prompt: string, config: RunConfig): Promise<string> {
  const provider = await createProvider(config);
  let text = "";

  for await (const chunk of provider.run(prompt, config)) {
    if (chunk.type === "text") {
      text += chunk.text;
    }
  }

  await provider.close();
  return text;
}
