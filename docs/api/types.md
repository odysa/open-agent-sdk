# Types

All types are exported from the `one-agent-sdk` package.

## StreamChunk

Discriminated union for streaming output events.

```typescript
type StreamChunk =
  | { type: "text"; text: string }
  | { type: "tool_call"; toolName: string; toolArgs: Record<string, unknown>; toolCallId: string }
  | { type: "tool_result"; toolCallId: string; result: string }
  | { type: "handoff"; fromAgent: string; toAgent: string }
  | { type: "error"; error: string }
  | { type: "done"; text?: string; usage?: { inputTokens: number; outputTokens: number } }
```

## AgentDef

Agent definition.

```typescript
interface AgentDef {
  name: string;
  description: string;
  prompt: string;
  tools?: ToolDef[];
  handoffs?: string[];
  model?: string;
  mcpServers?: Record<string, McpServerConfig>;
}
```

## ToolDef

Tool definition with Zod schema for parameters.

```typescript
interface ToolDef<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: T;
  handler: (params: z.infer<T>) => Promise<string>;
}
```

## RunConfig

Configuration for a run.

```typescript
interface RunConfig {
  provider: Provider;
  agent: AgentDef;
  agents?: Record<string, AgentDef>;
  mcpServers?: Record<string, McpServerConfig>;
  providerOptions?: Record<string, unknown>;
  workDir?: string;
  maxTurns?: number;
  signal?: AbortSignal;
}
```

## AgentRun

Handle returned by `run()`.

```typescript
interface AgentRun {
  stream: AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}
```

## McpServerConfig

MCP server configuration.

```typescript
interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}
```

## Provider

Supported provider backends.

```typescript
type Provider = "claude" | "codex" | "kimi";
```
