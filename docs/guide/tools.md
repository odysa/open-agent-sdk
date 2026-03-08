# Tools

Tools let agents interact with external systems.

## Claude Agent SDK (Recommended)

Using `one-agent-sdk/claude-agent-sdk`, tools follow the Anthropic Agent SDK interface:

```typescript
import { z } from "zod";
import { tool } from "one-agent-sdk/claude-agent-sdk";

const searchTool = tool(
  "search",
  "Search the web for information",
  {
    query: z.string().describe("Search query"),
    maxResults: z.number().optional().describe("Max results to return"),
  },
  async ({ query, maxResults }) => ({
    content: [{ type: "text" as const, text: JSON.stringify(await performSearch(query, maxResults)) }],
  }),
);
```

## Provider-Agnostic (Deprecated)

> **Note:** `defineTool` is deprecated and will be removed in v0.2.

```typescript
import { z } from "zod";
import { defineTool } from "one-agent-sdk";

const searchTool = defineTool({
  name: "search",
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().optional().describe("Max results to return"),
  }),
  handler: async ({ query, maxResults }) => {
    const results = await performSearch(query, maxResults);
    return JSON.stringify(results);
  },
});
```

## ToolDef Properties

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Unique tool name |
| `description` | `string` | Description shown to the LLM |
| `parameters` | `z.ZodType` | Zod schema defining the tool's input |
| `handler` | `(params) => Promise<string>` | Async function that executes the tool |

## Type Safety

The `handler` function receives fully typed parameters inferred from the Zod schema:

```typescript
const tool = defineTool({
  name: "create_user",
  description: "Create a new user",
  parameters: z.object({
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(0),
  }),
  handler: async ({ name, email, age }) => {
    // name: string, email: string, age: number — fully typed
    return JSON.stringify({ id: 1, name, email, age });
  },
});
```

## Return Values

Tool handlers must return a `string`. For structured data, use `JSON.stringify()`:

```typescript
handler: async ({ city }) => {
  const data = await fetchWeather(city);
  return JSON.stringify(data);
}
```

## Provider Differences

- **Claude** — tools are exposed via an in-process MCP server. Tool names follow the `mcp__{serverName}__{toolName}` convention internally.
- **Codex** — Zod schemas are converted to JSON Schema via `zodToJsonSchema()`. Tools are registered as OpenAI function tools.
- **Kimi** — tools are created using `createExternalTool`. Tool approval is automatic.

These differences are handled internally — your tool definitions work the same across all providers.
