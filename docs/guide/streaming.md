# Streaming

All providers return an `AsyncGenerator<StreamChunk>` — a unified stream of events you can process as they arrive.

## StreamChunk Types

The stream yields a discriminated union with these variants:

| Type | Fields | Description |
| --- | --- | --- |
| `text` | `text` | A chunk of generated text |
| `tool_call` | `toolName`, `toolArgs`, `toolCallId` | The agent is calling a tool |
| `tool_result` | `toolCallId`, `result` | A tool returned a result |
| `handoff` | `fromAgent`, `toAgent` | Control is transferring to another agent |
| `error` | `error` | An error occurred |
| `done` | `text?`, `usage?` | The run completed |

## Processing the Stream

Use a `for await...of` loop with a `switch` statement to handle each chunk type:

```typescript
const { stream } = await run("Hello", { provider: "claude", agent });

for await (const chunk of stream) {
  switch (chunk.type) {
    case "text":
      process.stdout.write(chunk.text);
      break;
    case "tool_call":
      console.log(`Calling ${chunk.toolName}`, chunk.toolArgs);
      break;
    case "tool_result":
      console.log(`Result: ${chunk.result}`);
      break;
    case "handoff":
      console.log(`${chunk.fromAgent} -> ${chunk.toAgent}`);
      break;
    case "done":
      console.log("Done!", chunk.usage);
      break;
    case "error":
      console.error(chunk.error);
      break;
  }
}
```

## Collecting Text

If you only need the final text output, use `runToCompletion()`:

```typescript
import { runToCompletion } from "one-agent-sdk";

const text = await runToCompletion("What is 2 + 2?", {
  provider: "claude",
  agent,
});

console.log(text); // "4"
```

## Follow-up Messages

Use the `chat()` function to send follow-up messages in the same conversation:

```typescript
const { stream, chat, close } = await run("Hello", {
  provider: "claude",
  agent,
});

// Process initial stream
for await (const chunk of stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}

// Send a follow-up
const followUp = chat("Tell me more");
for await (const chunk of followUp) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}

// Clean up
await close();
```

## Cancellation

Pass an `AbortSignal` to cancel a run:

```typescript
const controller = new AbortController();

const { stream } = await run("Write a long story", {
  provider: "claude",
  agent,
  signal: controller.signal,
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);
```
