import type { AgentDef, McpServerConfig, ToolDef } from "./types.js";

/**
 * Convenience helper to define an agent with type checking.
 * @deprecated Will be removed in v0.2. Use agent definitions from `one-agent-sdk` instead.
 */
export function defineAgent(config: {
  name: string;
  description: string;
  prompt: string;
  tools?: ToolDef[];
  handoffs?: string[];
  model?: string;
  mcpServers?: Record<string, McpServerConfig>;
}): AgentDef {
  return config;
}
