# defineMiddleware()

Helper to define a stream middleware.

## Signature

```typescript
function defineMiddleware(fn: Middleware): Middleware
```

Where `Middleware` is:

```typescript
type Middleware = (
  stream: AsyncGenerator<StreamChunk>,
  context: MiddlewareContext,
) => AsyncGenerator<StreamChunk>;
```

## Parameters

### `fn`

- **Type:** `Middleware`
- An async generator function that receives the provider's stream and a context object, and yields (possibly transformed) `StreamChunk` values.

### MiddlewareContext

| Property | Type | Description |
| --- | --- | --- |
| `agent` | [`AgentDef`](/api/types#agentdef) | The agent definition |
| `provider` | `string` | The provider name |

## Returns

`Middleware` — the same function, for use in `RunConfig.middleware`.

## Example

```typescript
import { defineMiddleware } from "one-agent-sdk";

const logger = defineMiddleware(async function* (stream, context) {
  for await (const chunk of stream) {
    if (chunk.type === "text") {
      console.log(`[${context.provider}]`, chunk.text);
    }
    yield chunk;
  }
});
```

## See Also

- [Middleware guide](/guide/middleware)
- [`run()`](/api/run) — pass middleware via `config.middleware`
