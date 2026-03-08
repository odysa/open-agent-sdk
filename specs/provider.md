# Provider Spec

Defines the `ProviderBackend` interface and built-in provider contracts.

**Source:** `src/providers/types.ts`, `src/providers/{claude,codex,copilot,kimi}.ts`, `src/utils/import-provider.ts`

## Interface

```ts
interface ProviderBackend {
  run(prompt: string, config: RunConfig): AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}
```

## Behavior

### `run(prompt, config)`

Starts a new conversation with the given prompt. Returns an `AsyncGenerator<StreamChunk>` that yields chunks as the model responds.

- MUST yield chunks conforming to the [streaming spec](streaming.md).
- MUST handle tool execution internally (call `ToolDef.handler`, yield `tool_call` then `tool_result`).
- MUST implement handoffs if the agent declares `handoffs` (see [agents-and-handoffs.md](agents-and-handoffs.md)).
- MUST respect `config.maxTurns` if set, stopping the tool loop after that many LLM round-trips.
- SHOULD respect `config.signal` for cancellation.

### `chat(message)`

Sends a follow-up message in the same conversation context. Returns a new `AsyncGenerator<StreamChunk>`.

- MUST maintain conversation state from the initial `run()` and any prior `chat()` calls.
- MUST yield chunks with the same contracts as `run()`.

### `close()`

Releases resources (connections, child processes, MCP servers).

- MUST be idempotent.
- SHOULD resolve promptly (no long-running cleanup).

## Built-in providers

| Provider name | Wraps | Peer dependency |
|--------------|-------|-----------------|
| `claude-code` | `@anthropic-ai/claude-agent-sdk` | `@anthropic-ai/claude-agent-sdk` |
| `codex` | `@openai/codex-sdk` | `@openai/codex-sdk` |
| `copilot` | `@github/copilot-sdk` | `@github/copilot-sdk` |
| `kimi-cli` | `@moonshot-ai/kimi-agent-sdk` | `@moonshot-ai/kimi-agent-sdk` |

All peer dependencies are optional. Dynamic `import()` via `importProvider()` ensures missing deps fail at runtime with a clear install hint, not at startup.

## Invariants

1. Every `run()` and `chat()` call MUST eventually yield a `done` chunk as the final item.
2. Providers MUST NOT yield chunks after `done`.
3. Providers MUST convert provider-specific errors into `error` chunks where possible.
4. `config.providerOptions` is an opaque bag — providers SHOULD pass relevant options to their underlying SDK.

## Error handling

- If the peer dependency is not installed, `importProvider()` throws with a message including the install command (e.g., `"@github/copilot-sdk is required. Install it with: bun add @github/copilot-sdk"`).
- API-level errors (auth, rate limits) SHOULD be surfaced as `error` chunks followed by `done`.
- Tool handler exceptions MUST be caught, yielded as `tool_result` with the error message, and the conversation continued.

## Edge cases

- A provider receiving an empty `tools` array MUST behave as if no tools are available.
- `providerOptions` MAY be ignored by providers that don't recognize specific keys.
- If `config.agent.model` is set, the provider SHOULD use it; otherwise it uses its own default.
