# Middleware API

## `defineMiddleware(fn)`

Wraps a middleware function. This is an identity helper for type safety and readability.

```typescript
import { defineMiddleware } from "one-agent-sdk";

const myMiddleware = defineMiddleware(async function* (stream, context) {
  for await (const chunk of stream) {
    yield chunk;
  }
});
```

**Parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `Middleware` | Async generator function `(stream, context) => AsyncGenerator<StreamChunk>` |

**Returns:** `Middleware`

## `applyMiddleware(stream, middleware, context)`

Composes an array of middleware over a stream. Used internally by `run()` — you typically don't need to call this directly.

```typescript
import { applyMiddleware } from "one-agent-sdk";

const transformed = applyMiddleware(rawStream, [mw1, mw2], context);
```

**Parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `stream` | `AsyncGenerator<StreamChunk>` | The source stream |
| `middleware` | `Middleware[]` | Middleware to apply (left-to-right) |
| `context` | `MiddlewareContext` | Context passed to each middleware |

**Returns:** `AsyncGenerator<StreamChunk>`

## Built-in Middleware

### `logging(options?)`

Log stream chunks. Passes all chunks through unmodified.

```typescript
function logging(options?: LoggingOptions): Middleware
```

### `usageTracker(options?)`

Accumulate token usage stats.

```typescript
function usageTracker(options?: UsageTrackerOptions): UsageTrackerHandle

interface UsageTrackerHandle {
  middleware: Middleware;
  getStats(): UsageStats;
  reset(): void;
}

interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  requests: number;
}
```

### `timing(options?)`

Measure stream timing.

```typescript
function timing(options?: TimingOptions): Middleware

interface TimingInfo {
  timeToFirstChunk: number;
  timeToFirstText: number | null;
  duration: number;
}
```

### `textCollector(options?)`

Collect response text.

```typescript
function textCollector(options?: TextCollectorOptions): TextCollectorHandle

interface TextCollectorHandle {
  middleware: Middleware;
  getText(): string;
}
```

### `guardrails(options)`

Content validation and blocking.

```typescript
function guardrails(options: GuardrailsOptions): Middleware
```

### `hooks(options)`

Observe chunks by type without transforming.

```typescript
function hooks(options: HooksOptions): Middleware
```

### `filter(options)`

Include or exclude chunks by type.

```typescript
function filter(options: FilterOptions): Middleware
```

## Types

### `Middleware`

```typescript
type Middleware = (
  stream: AsyncGenerator<StreamChunk>,
  context: MiddlewareContext,
) => AsyncGenerator<StreamChunk>;
```

### `MiddlewareContext`

```typescript
interface MiddlewareContext {
  agent: AgentDef;
  provider: Provider;
}
```

See the [Middleware Guide](/guide/middleware) for usage examples and all option types.
