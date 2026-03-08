import type { z } from "zod";
import { applyMiddleware } from "./middleware/index.js";
import type { AgentRun, RunConfig } from "./types.js";
import { createProvider } from "./utils/create-provider.js";
import { extractJson } from "./utils/extract-json.js";

/**
 * Start a run — returns a stream, chat handle, and close function.
 * @deprecated Will be removed in v0.2. Use `query()` from `one-agent-sdk` instead.
 */
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

/**
 * Convenience: run to completion and return collected text.
 * @deprecated Will be removed in v0.2. Use `query()` from `one-agent-sdk` instead.
 */
export async function runToCompletion(prompt: string, config: RunConfig): Promise<string>;
/** Convenience: run to completion and parse/validate against a Zod schema */
export async function runToCompletion<T extends z.ZodType>(
  prompt: string,
  config: RunConfig & { responseSchema: T },
): Promise<z.infer<T>>;
export async function runToCompletion<T extends z.ZodType>(
  prompt: string,
  config: RunConfig & { responseSchema?: T },
): Promise<string | z.infer<T>> {
  const { stream, close } = await run(prompt, config);
  let text = "";

  for await (const chunk of stream) {
    if (chunk.type === "text") {
      text += chunk.text;
    }
  }

  await close();

  if (!config.responseSchema) {
    return text;
  }

  const jsonText = extractJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse response as JSON: ${jsonText}`);
  }

  const result = config.responseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Response validation failed: ${JSON.stringify(result.error.issues, null, 2)}`);
  }

  return result.data;
}
