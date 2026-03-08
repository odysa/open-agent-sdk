# SDK Spec

Drop-in replacement for `@anthropic-ai/claude-agent-sdk` with multi-provider support.

**Source:** `src/sdk/claude-agent-sdk.ts` (barrel), `src/sdk/query.ts`, `src/sdk/tool.ts`, `src/sdk/mcp-server.ts`, `src/sdk/delegates.ts`, `src/sdk/adapt-stream.ts`, `src/sdk/types.ts`

## Overview

The `one-agent-sdk` subpath export is a drop-in replacement for `@anthropic-ai/claude-agent-sdk`. Users switch their import path and gain multi-provider support via `options.provider`.

```ts
// Before
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

// After — same API, multiple providers
import { query, tool, createSdkMcpServer } from "one-agent-sdk";
```

## Interface

### Types (148 exports)

All types from `@anthropic-ai/claude-agent-sdk` are defined in `src/compat/types.ts` — our own definitions, no runtime dependency on the Anthropic SDK for type checking. Key extension:

```ts
type Options = {
  // ... all Anthropic SDK options ...
  /** Provider routing (one-agent-sdk extension). Defaults to "claude-code". */
  provider?: string;
};
```

### `query(input)`

```ts
function query(input: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): AsyncIterable<SDKMessage>;
```

### `tool(name, description, inputSchema, handler, extras?)`

```ts
function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema>;
```

### `createSdkMcpServer(options)`

```ts
function createSdkMcpServer(options: CreateSdkMcpServerOptions): McpSdkServerConfigWithInstance;
```

### Delegate functions

These require `@anthropic-ai/claude-agent-sdk` at runtime (claude-code only):

```ts
function listSessions(options?: ListSessionsOptions): Promise<SDKSessionInfo[]>;
function getSessionMessages(sessionId: string, options?: GetSessionMessagesOptions): Promise<SessionMessage[]>;
function unstable_v2_createSession(options: SDKSessionOptions): Promise<SDKSession>;
function unstable_v2_prompt(message: string, options: SDKSessionOptions): Promise<SDKResultMessage>;
function unstable_v2_resumeSession(sessionId: string, options: SDKSessionOptions): Promise<SDKSession>;
```

## Behavior

### `query()` — provider routing

1. Read `options.provider` (defaults to `"claude-code"`).
2. **claude-code path:** dynamically import `@anthropic-ai/claude-agent-sdk`, materialize any mock MCP servers, then delegate to the real SDK's `query()`. Output is native `SDKMessage`.
3. **Other providers:** convert `Options` to `RunConfig` via `toRunConfig()`, instantiate the provider via shared `createProvider()`, pipe through `adaptStream()` to convert `StreamChunk` → `SDKMessage`.

### `tool()` — lightweight implementation

Returns a plain object with `{ name, description, inputSchema, handler, annotations }`. No runtime dependency. The object conforms to `SdkMcpToolDefinition<Schema>`.

### `createSdkMcpServer()` — mock MCP server

1. Returns an object with `type: "sdk"` and a `Symbol.for("one-agent-sdk-mock-mcp-server")` marker containing the original options.
2. On the claude-code path, `query()` detects the marker via `materializeMcpServers()` and creates a real MCP server using the Anthropic SDK's `createSdkMcpServer()`.
3. On other provider paths, tool definitions can be extracted directly from the mock config.

### `adaptStream()` — StreamChunk → SDKMessage

Maps the internal `StreamChunk` discriminated union to `SDKMessage`-shaped objects:

| StreamChunk type | SDKMessage type/subtype |
|-----------------|------------------------|
| `text` | `assistant` with text content block |
| `tool_call` | `assistant` with tool_use content block |
| `tool_result` | `result` with tool_use_id |
| `handoff` | `assistant` with text describing the handoff |
| `error` | `result` / `error_during_execution` |
| `done` | `result` / `success` |

An initial `system`/`init` message with a generated session ID is always emitted first.

### Delegate functions

Each function dynamically imports `@anthropic-ai/claude-agent-sdk` via `importProvider()` and calls the corresponding SDK function. These are claude-code-only — they throw if the SDK is not installed.

## Invariants

1. All 148 type exports MUST match the `@anthropic-ai/claude-agent-sdk` type names exactly.
2. `query()` MUST return `AsyncIterable<SDKMessage>` regardless of provider.
3. `tool()` and `createSdkMcpServer()` MUST NOT require the Anthropic SDK at import or call time.
4. Delegate functions MUST fail with a clear install hint if the SDK is missing.
5. The `Options.provider` extension MUST be optional and default to `"claude-code"`.
6. On the claude-code path, `query()` MUST produce identical output to the real SDK's `query()` (passthrough).

## Error handling

- Missing `@anthropic-ai/claude-agent-sdk` when using claude-code path or delegates: `importProvider()` throws with install hint.
- Unknown provider in `query()`: propagates from `createProvider()` with valid provider list.
- Stream errors from non-Claude providers: mapped to `result`/`error_during_execution` via `adaptStream()`.

## Edge cases

- `options.provider` is ignored by the real SDK on the claude-code path (it's our extension, SDK treats it as an unknown key).
- Mock MCP servers with no tools are valid — `createSdkMcpServer({ name: "empty" })` works.
- `query()` with `AsyncIterable<SDKUserMessage>` prompt is only supported on the claude-code path. Other providers receive `""` as the prompt string.
