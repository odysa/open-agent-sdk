# runToCompletion()

Convenience wrapper that runs an agent and returns the collected text output as a string.

## Signature

```typescript
function runToCompletion(prompt: string, config: RunConfig): Promise<string>
```

## Parameters

Same as [`run()`](/api/run#parameters).

## Returns

`Promise<string>` — the concatenated text output from the agent.

## Example

```typescript
import { defineAgent, runToCompletion } from "one-agent-sdk";

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant.",
});

const text = await runToCompletion("What is 2 + 2?", {
  provider: "claude",
  agent,
});

console.log(text); // "4"
```

## When to Use

Use `runToCompletion()` when you only need the final text output and don't need to process individual stream events (tool calls, handoffs, etc.). For more control, use [`run()`](/api/run) directly.
