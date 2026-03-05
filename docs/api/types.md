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
  middleware?: Middleware[];
  responseSchema?: z.ZodType;
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

Supported provider backends. Includes built-in providers and any registered custom providers.

```typescript
type BuiltinProvider = "claude-code" | "codex" | "kimi-cli";
type Provider = BuiltinProvider | (string & {});
```

## Middleware

Stream middleware function.

```typescript
type Middleware = (
  stream: AsyncGenerator<StreamChunk>,
  context: MiddlewareContext,
) => AsyncGenerator<StreamChunk>;
```

## MiddlewareContext

Context passed to each middleware function.

```typescript
interface MiddlewareContext {
  agent: AgentDef;
  provider: Provider;
}
```

## Session

Session handle for multi-turn conversations.

```typescript
interface Session {
  readonly id: string;
  run(prompt: string, config: RunConfig): Promise<AgentRun>;
  getHistory(): Promise<Message[]>;
  clear(): Promise<void>;
}
```

## Message

A message in the conversation history.

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
}
```

## SessionStore

Interface for session storage backends.

```typescript
interface SessionStore {
  load(sessionId: string): Promise<Message[]>;
  save(sessionId: string, messages: Message[]): Promise<void>;
}
```

## SessionConfig

Configuration options for `createSession()`.

```typescript
interface SessionConfig {
  sessionId?: string;
  store?: SessionStore;
  runner?: (prompt: string, config: RunConfig) => Promise<AgentRun>;
}
```

## ProviderBackend

Interface that provider implementations must satisfy.

```typescript
interface ProviderBackend {
  run(prompt: string, config: RunConfig): AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}
```

## ProviderFactory

Factory function for custom providers.

```typescript
type ProviderFactory = (config: RunConfig) => Promise<ProviderBackend>;
```

## zodToJsonSchema

Converts a Zod schema to JSON Schema. Used internally by providers that need JSON Schema (Codex, Kimi), but also exported for custom provider authors.

```typescript
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown>;
```
