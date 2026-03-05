# Structured Output

`runToCompletion()` can parse and validate the agent's response against a Zod schema, giving you typed, structured data instead of raw text.

## Basic Usage

Pass a `responseSchema` to `runToCompletion()`:

```typescript
import { z } from "zod";
import { defineAgent, runToCompletion } from "one-agent-sdk";

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant. Always respond with valid JSON.",
});

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
console.log(city.name);       // "Tokyo"
console.log(city.population); // 13960000
```

The return type is automatically inferred from the Zod schema — no type casting needed.

## How It Works

1. The agent runs to completion, collecting all text output
2. JSON is extracted from the response (supports raw JSON and markdown code fences)
3. The JSON is parsed and validated against the Zod schema
4. If validation fails, an error is thrown with details

## Error Handling

Two types of errors can occur:

```typescript
try {
  const result = await runToCompletion("...", {
    provider: "claude",
    agent,
    responseSchema: MySchema,
  });
} catch (error) {
  // "Failed to parse response as JSON: ..."
  // "Response validation failed: [{ code: ..., message: ... }]"
}
```

## Markdown Fence Support

The agent doesn't need to return raw JSON. Responses wrapped in markdown code fences are handled automatically:

````
```json
{ "name": "Tokyo", "country": "Japan", "population": 13960000 }
```
````

## Without a Schema

When called without `responseSchema`, `runToCompletion()` returns a plain string as before:

```typescript
const text = await runToCompletion("What is 2 + 2?", {
  provider: "claude",
  agent,
});
// text: string
```
