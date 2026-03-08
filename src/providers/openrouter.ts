import type { RunConfig } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai.js";
import type { ProviderBackend } from "./types.js";

export async function createOpenRouterProvider(config: RunConfig): Promise<ProviderBackend> {
  const opts = (config.providerOptions ?? {}) as Record<string, unknown>;
  const apiKey = (opts.apiKey as string) ?? process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouter requires an API key. Set OPENROUTER_API_KEY or pass providerOptions.apiKey",
    );
  }

  if (!config.agent.model) {
    throw new Error("OpenRouter requires agent.model to be set (e.g. 'anthropic/claude-sonnet-4')");
  }

  const defaultHeaders: Record<string, string> = {};
  if (opts.httpReferer) defaultHeaders["HTTP-Referer"] = opts.httpReferer as string;
  if (opts.xTitle) defaultHeaders["X-Title"] = opts.xTitle as string;

  return createOpenAICompatibleProvider(config, {
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders,
    providerOptions: opts,
  });
}
