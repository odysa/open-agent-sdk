# defineTool()

Helper to define a tool with type-safe parameters using Zod.

## Signature

```typescript
function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  parameters: T;
  handler: (params: z.infer<T>) => Promise<string>;
}): ToolDef<T>
```

## Parameters

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | Unique tool name |
| `description` | `string` | Yes | Description shown to the LLM |
| `parameters` | `z.ZodType` | Yes | Zod schema for the tool's input |
| `handler` | `(params) => Promise<string>` | Yes | Async function that executes the tool |

## Returns

[`ToolDef<T>`](/api/types#tooldef) — the tool definition object with inferred parameter types.

## Example

```typescript
import { z } from "zod";
import { defineTool } from "one-agent-sdk";

const weatherTool = defineTool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  handler: async ({ city, units }) => {
    // city: string, units: "celsius" | "fahrenheit" | undefined
    const data = await fetchWeather(city, units);
    return JSON.stringify(data);
  },
});
```

## Notes

- The `handler` receives parameters parsed and validated by Zod
- Return values must be strings — use `JSON.stringify()` for structured data
- The Zod schema is converted to JSON Schema internally for providers that need it
