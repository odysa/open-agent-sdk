# runToCompletion()

Convenience wrapper that runs an agent and returns the collected text output. Optionally validates the response against a Zod schema for structured output.

## Signatures

```typescript
function runToCompletion(prompt: string, config: RunConfig): Promise<string>

function runToCompletion<T extends z.ZodType>(
  prompt: string,
  config: RunConfig & { responseSchema: T },
): Promise<z.infer<T>>
```

## Parameters

Same as [`run()`](/api/run#parameters).

When `responseSchema` is provided, the response is parsed as JSON and validated against the schema.

## Returns

- **Without `responseSchema`:** `Promise<string>` — the concatenated text output.
- **With `responseSchema`:** `Promise<z.infer<T>>` — the parsed and validated object.

## Examples

### Plain text

```typescript
const text = await runToCompletion("What is 2 + 2?", {
  provider: "claude",
  agent,
});

console.log(text); // "4"
```

### Structured output

```typescript
import { z } from "zod";

const City = z.object({
  name: z.string(),
  country: z.string(),
  population: z.number(),
});

const city = await runToCompletion("Give me info about Tokyo as JSON.", {
  provider: "claude",
  agent,
  responseSchema: City,
});

// city: { name: string; country: string; population: number }
console.log(city.name); // "Tokyo"
```

## Error Handling

When using `responseSchema`, two types of errors can occur:

- `"Failed to parse response as JSON: ..."` — the agent's response wasn't valid JSON
- `"Response validation failed: ..."` — JSON was valid but didn't match the schema

## When to Use

Use `runToCompletion()` when you only need the final output and don't need to process individual stream events (tool calls, handoffs, etc.). For more control, use [`run()`](/api/run) directly.

## See Also

- [Structured Output guide](/guide/structured-output)
