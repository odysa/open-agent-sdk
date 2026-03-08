# Tools

Tools let agents interact with external systems. Define tools using the same `tool()` function from `@anthropic-ai/claude-agent-sdk`:

## Defining a Tool

```typescript
import { z } from "zod";
import { tool } from "one-agent-sdk";

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

## Using Tools with an MCP Server

Tools are registered via `createSdkMcpServer()` and passed to `query()`:

```typescript
import { query, tool, createSdkMcpServer } from "one-agent-sdk";

const mcpServer = createSdkMcpServer({
  name: "tools",
  version: "1.0.0",
  tools: [searchTool],
});

const conversation = query({
  prompt: "Search for TypeScript best practices",
  options: {
    mcpServers: { tools: mcpServer },
    allowedTools: ["mcp__tools__search"],
  },
});
```

## Type Safety

The handler receives fully typed parameters inferred from the Zod schema:

```typescript
const createUser = tool(
  "create_user",
  "Create a new user",
  {
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(0),
  },
  async ({ name, email, age }) => {
    // name: string, email: string, age: number — fully typed
    return { content: [{ type: "text" as const, text: JSON.stringify({ id: 1, name, email, age }) }] };
  },
);
```

## Return Values

Tool handlers return `{ content: [{ type: "text", text: string }] }` — the standard MCP `CallToolResult` format.

## Provider Differences

- **Claude** — tools are exposed via an in-process MCP server. Tool names follow the `mcp__{serverName}__{toolName}` convention.
- **Codex** — tools from MCP servers are used natively.
- **Kimi** — tools are created using `createExternalTool`. Tool approval is automatic.

These differences are handled internally — your tool definitions work the same across all providers.
