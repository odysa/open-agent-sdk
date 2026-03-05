import { applyMiddleware } from "./middleware.js";
import type { ProviderBackend } from "./providers/types.js";
import { getProvider } from "./registry.js";
import type { AgentRun, RunConfig } from "./types.js";

async function createProvider(config: RunConfig): Promise<ProviderBackend> {
  // Check registry first (custom providers)
  const factory = getProvider(config.provider);
  if (factory) return factory(config);

  // Built-in providers
  switch (config.provider) {
    case "claude": {
      const { createClaudeProvider } = await import("./providers/claude.js");
      return createClaudeProvider(config);
    }
    case "codex": {
      const { createCodexProvider } = await import("./providers/codex.js");
      return createCodexProvider(config);
    }
    case "kimi": {
      const { createKimiProvider } = await import("./providers/kimi.js");
      return createKimiProvider(config);
    }
    default:
      throw new Error(
        `Unknown provider: ${config.provider}. Use: claude, codex, kimi, or register a custom provider with registerProvider()`,
      );
  }
}

/** Start a run — returns a stream, chat handle, and close function */
export async function run(prompt: string, config: RunConfig): Promise<AgentRun> {
  const provider = await createProvider(config);
  const middleware = config.middleware;

  if (!middleware?.length) {
    return {
      stream: provider.run(prompt, config),
      chat: (message: string) => provider.chat(message),
      close: () => provider.close(),
    };
  }

  const mwContext = { agent: config.agent, provider: config.provider };

  return {
    stream: applyMiddleware(provider.run(prompt, config), middleware, mwContext),
    chat: (message: string) => applyMiddleware(provider.chat(message), middleware, mwContext),
    close: () => provider.close(),
  };
}

/** Convenience: run to completion and return collected text */
export async function runToCompletion(prompt: string, config: RunConfig): Promise<string> {
  const { stream, close } = await run(prompt, config);
  let text = "";

  for await (const chunk of stream) {
    if (chunk.type === "text") {
      text += chunk.text;
    }
  }

  await close();
  return text;
}
