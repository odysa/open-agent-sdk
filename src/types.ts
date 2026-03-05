import type { z } from "zod";

/** Tool definition with Zod schema for parameters */
export interface ToolDef<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: T;
  handler: (params: z.infer<T>) => Promise<string>;
}

/** MCP server configuration */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

/** Agent definition */
export interface AgentDef {
  name: string;
  description: string;
  prompt: string;
  tools?: ToolDef[];
  handoffs?: string[];
  model?: string;
  mcpServers?: Record<string, McpServerConfig>;
}

/** Discriminated union for streaming output */
export type StreamChunk =
  | { type: "text"; text: string }
  | {
      type: "tool_call";
      toolName: string;
      toolArgs: Record<string, unknown>;
      toolCallId: string;
    }
  | { type: "tool_result"; toolCallId: string; result: string }
  | { type: "handoff"; fromAgent: string; toAgent: string }
  | { type: "error"; error: string }
  | {
      type: "done";
      text?: string;
      usage?: { inputTokens: number; outputTokens: number };
    };

/** Supported provider backends */
export type Provider = "claude" | "codex" | "kimi";

/** Context passed to each middleware function */
export interface MiddlewareContext {
  agent: AgentDef;
  provider: string;
}

/** Middleware transforms the stream between provider and consumer */
export type Middleware = (
  stream: AsyncGenerator<StreamChunk>,
  context: MiddlewareContext,
) => AsyncGenerator<StreamChunk>;

/** Configuration for a run */
export interface RunConfig {
  provider: Provider;
  agent: AgentDef;
  /** Additional agents for handoffs */
  agents?: Record<string, AgentDef>;
  mcpServers?: Record<string, McpServerConfig>;
  providerOptions?: Record<string, unknown>;
  workDir?: string;
  maxTurns?: number;
  signal?: AbortSignal;
  middleware?: Middleware[];
}

/** Handle returned by run() */
export interface AgentRun {
  stream: AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}
