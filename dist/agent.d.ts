import type { AgentDef, ToolDef, McpServerConfig } from "./types.js";
/** Convenience helper to define an agent with type checking */
export declare function defineAgent(config: {
    name: string;
    description: string;
    prompt: string;
    tools?: ToolDef[];
    handoffs?: string[];
    model?: string;
    mcpServers?: Record<string, McpServerConfig>;
}): AgentDef;
