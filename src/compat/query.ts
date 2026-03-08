import type { AgentDef, Provider, RunConfig, ToolDef } from "../types.js";
import { createProvider } from "../utils/create-provider.js";
import { adaptStream } from "./adapt-stream.js";
import { sdk } from "./delegates.js";
import { MOCK_MCP_SERVER, type MockMcpServerConfig } from "./mcp-server.js";
import type { Options, SDKMessage, SDKUserMessage } from "./types.js";

/**
 * Extract ToolDef[] from mock MCP server configs so non-Claude providers
 * can use tools defined via createSdkMcpServer() + tool().
 */
function extractToolsFromMcpServers(mcpServers: Record<string, any>): ToolDef[] {
  const tools: ToolDef[] = [];
  for (const config of Object.values(mcpServers)) {
    if (config && typeof config === "object" && MOCK_MCP_SERVER in config) {
      const mockConfig = (config as MockMcpServerConfig)[MOCK_MCP_SERVER];
      for (const t of mockConfig.tools ?? []) {
        tools.push({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema as any,
          handler: async (params: any) => {
            const result = await t.handler(params, {});
            return JSON.stringify(result);
          },
        });
      }
    }
  }
  return tools;
}

export function toRunConfig(provider: Provider, options: Record<string, any>): RunConfig {
  const mcpTools = options.mcpServers ? extractToolsFromMcpServers(options.mcpServers) : [];

  const agent: AgentDef = {
    name: options.agentName ?? "default",
    description: options.agentDescription ?? "Default agent",
    prompt: options.systemPrompt ?? "You are a helpful assistant.",
    model: options.model,
    tools: mcpTools.length > 0 ? mcpTools : undefined,
  };

  return {
    provider,
    agent,
    maxTurns: options.maxTurns,
    workDir: options.cwd,
    signal: options.abortController?.signal,
    providerOptions: options.providerOptions,
  };
}

/**
 * Materialize mock MCP servers into real ones using the Anthropic SDK.
 * Our createSdkMcpServer() stores tool definitions as a mock config;
 * the real SDK's createSdkMcpServer() creates the actual McpServer instance.
 */
async function materializeMcpServers(
  servers: Record<string, any>,
  sdk: any,
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  for (const [key, config] of Object.entries(servers)) {
    if (config && typeof config === "object" && MOCK_MCP_SERVER in config) {
      result[key] = sdk.createSdkMcpServer(config[MOCK_MCP_SERVER]);
    } else {
      result[key] = config;
    }
  }
  return result;
}

/**
 * Provider-agnostic query() following the @anthropic-ai/claude-agent-sdk signature.
 *
 * Pass `options.provider` to route to a different backend:
 * - `"claude-code"` (default) — delegates to the real Anthropic SDK
 * - `"codex"` — routes to OpenAI Codex
 * - `"kimi-cli"` — routes to Kimi
 * - Any registered custom provider name
 *
 * The output stream emits SDKMessage-shaped objects regardless of backend.
 */
export function query(input: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): AsyncIterable<SDKMessage> {
  const { prompt, options = {} } = input;
  const provider: Provider = (options.provider as string) ?? "claude-code";

  if (provider === "claude-code") {
    return (async function* () {
      const s = await sdk();
      // Materialize mock MCP servers into real ones
      const resolvedOptions = options.mcpServers
        ? { ...options, mcpServers: await materializeMcpServers(options.mcpServers, s) }
        : options;
      yield* s.query({ prompt, options: resolvedOptions }) as AsyncIterable<SDKMessage>;
    })();
  }

  return (async function* () {
    const config = toRunConfig(provider, options as Record<string, any>);
    const backend = await createProvider(config);
    try {
      yield* adaptStream(
        backend.run(typeof prompt === "string" ? prompt : "", config),
      ) as AsyncGenerator<SDKMessage>;
    } finally {
      await backend.close();
    }
  })();
}
