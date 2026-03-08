import type { ProviderBackend } from "../providers/types.js";
import { getProvider } from "../registry.js";
import type { RunConfig } from "../types.js";

/** Resolve a provider backend from registry or built-in providers. */
export async function createProvider(config: RunConfig): Promise<ProviderBackend> {
  // Check registry first (custom providers)
  const factory = getProvider(config.provider);
  if (factory) return factory(config);

  // Built-in providers
  switch (config.provider) {
    case "claude-code": {
      const { createClaudeProvider } = await import("../providers/claude.js");
      return createClaudeProvider(config);
    }
    case "codex": {
      const { createCodexProvider } = await import("../providers/codex.js");
      return createCodexProvider(config);
    }
    case "kimi-cli": {
      const { createKimiProvider } = await import("../providers/kimi.js");
      return createKimiProvider(config);
    }
    case "copilot": {
      const { createCopilotProvider } = await import("../providers/copilot.js");
      return createCopilotProvider(config);
    }
    case "openai": {
      const { createOpenAIProvider } = await import("../providers/openai.js");
      return createOpenAIProvider(config);
    }
    case "anthropic": {
      const { createAnthropicProvider } = await import("../providers/anthropic.js");
      return createAnthropicProvider(config);
    }
    case "openrouter": {
      const { createOpenRouterProvider } = await import("../providers/openrouter.js");
      return createOpenRouterProvider(config);
    }
    default:
      throw new Error(
        `Unknown provider: ${config.provider}. Use: claude-code, codex, copilot, kimi-cli, openai, anthropic, openrouter, or register a custom provider with registerProvider()`,
      );
  }
}
