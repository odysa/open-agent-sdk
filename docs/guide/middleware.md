# Middleware

Middleware lets you transform the stream between the provider and your application. Each middleware is an async generator function that receives the stream and yields (possibly modified) chunks.

## Defining Middleware

Use `defineMiddleware()` to create a middleware:

```typescript
import { defineMiddleware } from "one-agent-sdk";

const logger = defineMiddleware(async function* (stream, context) {
  for await (const chunk of stream) {
    if (chunk.type === "text") {
      console.log(`[${context.provider}] ${chunk.text}`);
    }
    yield chunk;
  }
});
```

The `context` parameter provides:

| Property | Type | Description |
| --- | --- | --- |
| `agent` | `AgentDef` | The agent definition |
| `provider` | `string` | The provider name |

## Using Middleware

Pass middleware to `run()` via the `middleware` option:

```typescript
const { stream } = await run("Hello", {
  provider: "claude",
  agent,
  middleware: [logger],
});
```

Middleware is also applied to `chat()` follow-up streams automatically.

## Composing Middleware

Multiple middleware are applied in order — the output of one becomes the input of the next:

```typescript
const { stream } = await run("Hello", {
  provider: "claude",
  agent,
  middleware: [logger, filter, transform],
});
```

## Examples

### Filtering chunks

```typescript
const textOnly = defineMiddleware(async function* (stream) {
  for await (const chunk of stream) {
    if (chunk.type === "text" || chunk.type === "done") {
      yield chunk;
    }
  }
});
```

### Timing

```typescript
const timer = defineMiddleware(async function* (stream, context) {
  const start = Date.now();
  for await (const chunk of stream) {
    yield chunk;
  }
  console.log(`[${context.provider}] completed in ${Date.now() - start}ms`);
});
```

### Transforming text

```typescript
const uppercase = defineMiddleware(async function* (stream) {
  for await (const chunk of stream) {
    if (chunk.type === "text") {
      yield { ...chunk, text: chunk.text.toUpperCase() };
    } else {
      yield chunk;
    }
  }
});
```
