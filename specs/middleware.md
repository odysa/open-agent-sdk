# Middleware Spec

Defines the middleware type, composition model, and built-in middleware contracts.

**Source:** `src/middleware/core.ts`, `src/middleware/*.ts`

## Interface

```ts
type Middleware = (
  stream: AsyncGenerator<StreamChunk>,
  context: MiddlewareContext,
) => AsyncGenerator<StreamChunk>;

interface MiddlewareContext {
  agent: AgentDef;
  provider: Provider;
}

function defineMiddleware(fn: Middleware): Middleware;
function applyMiddleware(
  stream: AsyncGenerator<StreamChunk>,
  middleware: Middleware[],
  context: MiddlewareContext,
): AsyncGenerator<StreamChunk>;
```

## Behavior

### `defineMiddleware(fn)`

Identity wrapper for type safety. Returns `fn` unchanged.

### `applyMiddleware(stream, middleware, context)`

Composes middleware via left-to-right `reduce`: `middleware[0]` wraps the raw stream, `middleware[1]` wraps the result of `middleware[0]`, etc. The consumer reads from the outermost wrapper.

### Stateful middleware pattern

Some built-in middleware (`usageTracker`, `textCollector`, `timing`) return a **handle** object containing:
- `middleware` — the `Middleware` function to pass into `config.middleware`
- Accessor methods (e.g., `getStats()`, `getText()`, `getInfo()`) to read accumulated state

## Built-in middleware

| Name | Purpose | Stateful |
|------|---------|----------|
| `logging` | Log chunks to console or custom logger | No |
| `filter` | Include/exclude chunks by type or predicate | No |
| `guardrails` | Block text matching keywords or custom validator | No |
| `hooks` | Fire callbacks per chunk type | No |
| `usageTracker` | Accumulate token usage across `done` chunks | Yes |
| `textCollector` | Accumulate text, optionally prefer `done.text` | Yes |
| `timing` | Measure time-to-first-chunk, time-to-first-text, duration | Yes |

## Invariants

1. Middleware MUST yield all chunks it does not intentionally suppress — passthrough is the default.
2. Middleware MUST NOT swallow the `done` chunk. Suppressing `done` breaks stream termination.
3. `applyMiddleware` MUST apply middleware in array order (index 0 is innermost, last is outermost).
4. Stateful middleware MUST reset accumulated state when the middleware function is re-entered (new stream).
5. Middleware MUST NOT buffer chunks indefinitely — yield as soon as processing is complete.

## Error handling

- If a middleware function throws, the error propagates to the consumer reading the stream.
- Middleware SHOULD NOT catch and swallow errors from the upstream generator unless explicitly designed to (e.g., a retry middleware).
- `guardrails` replaces blocked text chunks with `error` chunks (when `onBlock: "error"`) or drops them silently (when `onBlock: "drop"`).

## Edge cases

- An empty middleware array results in no wrapping — the raw provider stream is returned.
- `filter` with both `include` and `exclude` set: `include` takes precedence (checked first).
- `filter` with a `predicate`: the predicate overrides `include`/`exclude` entirely.
- `textCollector` with `preferDoneText: true` (default): if `done.text` is present, it replaces any text accumulated from `text` chunks.
- `usageTracker` increments `requests` by 1 for every `done` chunk, regardless of whether `usage` is present.
