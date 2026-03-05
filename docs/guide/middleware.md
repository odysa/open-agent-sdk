# Middleware

Middleware transforms, observes, or filters the stream between the provider and your application. Middleware composes — you can stack multiple middleware in a pipeline and each one processes chunks in order.

## Using Middleware

Pass an array of middleware to `RunConfig.middleware`:

```typescript
import { run, logging, usageTracker, timing } from "one-agent-sdk";

const tracker = usageTracker();

const { stream } = await run("Summarize this article", {
  provider: "claude",
  agent,
  middleware: [
    logging(),
    tracker.middleware,
    timing({ onComplete: (info) => console.log(`Done in ${info.duration}ms`) }),
  ],
});

for await (const chunk of stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}

console.log(tracker.getStats()); // { inputTokens: 100, outputTokens: 50, requests: 1 }
```

Middleware also applies to `chat()` follow-up messages automatically.

## Built-in Middleware

### `logging(options?)`

Log stream chunks to the console or a custom logger.

```typescript
import { logging } from "one-agent-sdk";

// Log everything
logging();

// Log only text chunks with a custom label
logging({ types: ["text"], label: "[my-app]" });

// Custom logger function
logging({ logger: (message, chunk) => myLogger.info(message) });
```

**Options:**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `logger` | `(message, chunk) => void` | `console.log` | Custom logging function |
| `types` | `StreamChunk["type"][]` | all | Which chunk types to log |
| `label` | `string` | `"[middleware:logging]"` | Prefix for log messages |

### `usageTracker(options?)`

Accumulate token usage from `done` chunks. Returns a stateful handle.

```typescript
import { usageTracker } from "one-agent-sdk";

const tracker = usageTracker({
  onUsage: (stats) => console.log(`Tokens: ${stats.inputTokens} in, ${stats.outputTokens} out`),
});

// Use tracker.middleware in your middleware array
// After the stream completes:
tracker.getStats(); // { inputTokens, outputTokens, requests }
tracker.reset();    // Clear accumulated stats
```

**Options:**

| Option | Type | Description |
| --- | --- | --- |
| `onUsage` | `(stats: UsageStats) => void` | Callback after each `done` chunk with cumulative stats |

**Returns:** `{ middleware, getStats(), reset() }`

### `timing(options?)`

Measure time-to-first-text (TTFT), time-to-first-chunk, and total stream duration. Returns a stateful handle.

```typescript
import { timing } from "one-agent-sdk";

const t = timing({
  onFirstText: (ms) => console.log(`TTFT: ${ms}ms`),
  onComplete: ({ timeToFirstChunk, timeToFirstText, duration }) => {
    console.log(`Total: ${duration}ms`);
  },
});

// Use t.middleware in your middleware array
// After the stream completes:
t.getInfo(); // { timeToFirstChunk, timeToFirstText, duration }
```

**Options:**

| Option | Type | Description |
| --- | --- | --- |
| `onFirstText` | `(elapsed: number) => void` | Callback when first text chunk arrives |
| `onComplete` | `(info: TimingInfo) => void` | Callback when stream completes |

**Returns:** `{ middleware, getInfo() }`

### `textCollector(options?)`

Collect the full response text. Returns a stateful handle.

```typescript
import { textCollector } from "one-agent-sdk";

const collector = textCollector({
  onText: (text) => updatePreview(text),      // Running text as it streams
  onComplete: (text) => saveResponse(text),   // Final text
});

// After the stream completes:
collector.getText(); // Full response text
```

By default, if the `done` chunk includes a `text` field, it is used as the authoritative final text. Set `preferDoneText: false` to use the accumulated text chunks instead.

**Options:**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `onText` | `(text: string) => void` | — | Callback on each text chunk with running accumulated text |
| `onComplete` | `(text: string) => void` | — | Callback when stream completes with final text |
| `preferDoneText` | `boolean` | `true` | Use `done.text` as authoritative when available |

**Returns:** `{ middleware, getText() }`

### `guardrails(options)`

Block or replace text chunks based on keyword lists or custom validation.

```typescript
import { guardrails } from "one-agent-sdk";

// Block text containing sensitive keywords
guardrails({ blockedKeywords: ["password", "secret", "api_key"] });

// Custom validation: replace or block
guardrails({
  validate: (text) => {
    if (text.includes("REDACTED")) return "[content removed]"; // Replace
    if (text.includes("FORBIDDEN")) return false;              // Block
    return true;                                               // Allow
  },
});

// Silently drop blocked text instead of emitting an error chunk
guardrails({ blockedKeywords: ["secret"], onBlock: "drop" });
```

**Options:**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `blockedKeywords` | `string[]` | `[]` | Block text containing any of these keywords |
| `validate` | `(text) => boolean \| string` | — | Custom validation: `true` = allow, `false` = block, `string` = replace |
| `onBlock` | `"error" \| "drop"` | `"error"` | Emit an error chunk or silently drop |
| `caseInsensitive` | `boolean` | `true` | Case-insensitive keyword matching |

### `hooks(options)`

Observe stream events without transforming them. Useful for analytics, debugging, or side effects.

```typescript
import { hooks } from "one-agent-sdk";

hooks({
  onText: (chunk) => analytics.track("text", chunk.text.length),
  onToolCall: (chunk) => console.log(`Tool: ${chunk.toolName}`),
  onHandoff: (chunk) => console.log(`${chunk.fromAgent} -> ${chunk.toAgent}`),
  onError: (chunk) => errorTracker.report(chunk.error),
  onDone: (chunk) => console.log("Usage:", chunk.usage),
  onChunk: (chunk) => allChunksLog.push(chunk), // Catch-all
});
```

**Options:**

| Option | Type | Description |
| --- | --- | --- |
| `onText` | `(chunk) => void` | Called for `text` chunks |
| `onToolCall` | `(chunk) => void` | Called for `tool_call` chunks |
| `onToolResult` | `(chunk) => void` | Called for `tool_result` chunks |
| `onHandoff` | `(chunk) => void` | Called for `handoff` chunks |
| `onError` | `(chunk) => void` | Called for `error` chunks |
| `onDone` | `(chunk) => void` | Called for `done` chunks |
| `onChunk` | `(chunk) => void` | Called for every chunk (catch-all) |

### `filter(options)`

Include or exclude chunks by type, or apply a custom predicate.

```typescript
import { filter } from "one-agent-sdk";

// Only keep text and done chunks
filter({ include: ["text", "done"] });

// Drop tool-related chunks
filter({ exclude: ["tool_call", "tool_result"] });

// Custom predicate (overrides include/exclude)
filter({ predicate: (chunk) => chunk.type !== "error" });
```

**Options:**

| Option | Type | Description |
| --- | --- | --- |
| `include` | `StreamChunk["type"][]` | Chunk types to keep (exclusive with `exclude`) |
| `exclude` | `StreamChunk["type"][]` | Chunk types to drop |
| `predicate` | `(chunk) => boolean` | Custom filter function (overrides include/exclude) |

## Custom Middleware

Use `defineMiddleware` to write your own. A middleware is an async generator that receives the upstream stream and a context object, and yields transformed chunks:

```typescript
import { defineMiddleware } from "one-agent-sdk";

const upperCase = defineMiddleware(async function* (stream, context) {
  for await (const chunk of stream) {
    if (chunk.type === "text") {
      yield { ...chunk, text: chunk.text.toUpperCase() };
    } else {
      yield chunk;
    }
  }
});
```

The `context` object provides:

| Property | Type | Description |
| --- | --- | --- |
| `agent` | `AgentDef` | The current agent definition |
| `provider` | `Provider` | The provider name |

### Composition

Middleware composes left-to-right. The first middleware in the array receives the raw provider stream, the second receives the first's output, and so on:

```typescript
middleware: [first, second, third]
// Provider stream -> first -> second -> third -> your code
```

### Dropping Chunks

To filter chunks, simply don't yield them:

```typescript
const dropErrors = defineMiddleware(async function* (stream) {
  for await (const chunk of stream) {
    if (chunk.type !== "error") yield chunk;
  }
});
```

### Injecting Chunks

Yield extra chunks to add to the stream:

```typescript
const addTimestamp = defineMiddleware(async function* (stream) {
  yield { type: "text", text: `[${new Date().toISOString()}] ` };
  yield* stream;
});
```
