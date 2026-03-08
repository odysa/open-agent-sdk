# Streaming Spec

Defines the `StreamChunk` discriminated union and stream ordering invariants.

**Source:** `src/types.ts`

## Interface

```ts
type StreamChunk =
  | { type: "text"; text: string }
  | { type: "tool_call"; toolName: string; toolArgs: Record<string, unknown>; toolCallId: string }
  | { type: "tool_result"; toolCallId: string; result: string }
  | { type: "handoff"; fromAgent: string; toAgent: string }
  | { type: "error"; error: string }
  | { type: "done"; text?: string; usage?: { inputTokens: number; outputTokens: number } };
```

## Behavior

Every provider and middleware operates on `AsyncGenerator<StreamChunk>`. Chunks are yielded incrementally as the LLM produces output.

- **`text`** — a fragment of the model's text response. Multiple text chunks concatenate to form the full response.
- **`tool_call`** — the model is invoking a tool. `toolCallId` is provider-assigned and unique within a run.
- **`tool_result`** — the result of executing a tool. `toolCallId` MUST match a preceding `tool_call`.
- **`handoff`** — the active agent is transferring control. `fromAgent` is the current agent's name, `toAgent` is the target.
- **`error`** — a non-fatal error. The stream MAY continue after an error chunk.
- **`done`** — signals stream completion. `text` SHOULD contain the full accumulated response text. `usage` SHOULD contain token counts when the provider supports it.

## Invariants

1. Every stream MUST emit exactly one `done` chunk, and it MUST be the last chunk yielded.
2. A `tool_result` chunk MUST be preceded by a `tool_call` chunk with a matching `toolCallId`.
3. `text` chunks MUST NOT be empty strings.
4. `toolCallId` values MUST be unique within a single run.
5. `done.text` SHOULD equal the concatenation of all `text` chunks in the stream, but providers MAY use a more authoritative source (e.g., the API's final response).
6. Middleware MUST forward the `done` chunk (it MAY transform it, but MUST NOT swallow it).

## Error handling

- Providers SHOULD yield an `error` chunk for recoverable errors (e.g., a tool handler throwing), then continue the stream if possible.
- For unrecoverable errors, providers SHOULD yield an `error` chunk followed by a `done` chunk.
- If the underlying API connection fails mid-stream, the generator MAY throw. Consumers MUST handle generator throws.

## Edge cases

- A stream with no text output (e.g., tool-only interaction) MUST still emit a `done` chunk. `done.text` MAY be `undefined` or an empty string.
- Multiple `handoff` chunks MAY appear in a single stream (chained handoffs).
- `error` chunks do not terminate the stream — only `done` does.
