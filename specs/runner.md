# Runner Spec

Defines `run()`, `runToCompletion()`, and provider resolution.

**Source:** `src/runner.ts`

## Interface

```ts
function run(prompt: string, config: RunConfig): Promise<AgentRun>;
function runToCompletion(prompt: string, config: RunConfig): Promise<string>;
function runToCompletion<T extends z.ZodType>(
  prompt: string,
  config: RunConfig & { responseSchema: T },
): Promise<z.infer<T>>;

interface AgentRun {
  stream: AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}

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

## Behavior

### Provider resolution (`createProvider`)

1. Check the registry first via `getProvider(config.provider)`. If a factory exists, use it.
2. If not registered, match against built-in provider names (`claude-code`, `codex`, `copilot`, `kimi-cli`).
3. Built-in providers are dynamically imported to keep peer dependencies optional.
4. If no match, throw with a message listing valid options.

### `run()`

1. Resolve and instantiate the provider via `createProvider`.
2. If `config.middleware` is empty or absent, return the provider's raw `run`/`chat`/`close` directly.
3. If middleware is present, wrap both `stream` and `chat` through `applyMiddleware`. `close` is passed through unwrapped.
4. The `MiddlewareContext` passed to middleware contains `{ agent, provider }` from the config.

### `runToCompletion()`

1. Call `run()` to get the stream.
2. Consume the entire stream, concatenating `text` chunks.
3. Call `close()` after stream exhaustion.
4. If no `responseSchema`, return the concatenated text.
5. If `responseSchema` is set, extract JSON and validate (see [structured-output.md](structured-output.md)).

## Invariants

1. `run()` MUST always return a valid `AgentRun` or throw — never return partial results.
2. Middleware MUST be applied to both `stream` and `chat` generators identically.
3. `close()` MUST be callable multiple times without error (idempotent).
4. `runToCompletion()` MUST call `close()` even if stream consumption throws.

## Error handling

- Unknown provider: throws `Error` with message listing valid providers.
- Provider instantiation failure: the error propagates from `createProvider`.
- Stream errors during `runToCompletion`: the error propagates to the caller after `close()`.

## Edge cases

- `config.middleware` as an empty array (`[]`) is treated the same as `undefined` — no wrapping occurs.
- `runToCompletion` ignores non-text chunks (tool_call, tool_result, handoff, error) for text accumulation.
