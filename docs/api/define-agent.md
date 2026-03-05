# defineAgent()

Helper to define an agent with type checking.

## Signature

```typescript
function defineAgent(config: {
  name: string;
  description: string;
  prompt: string;
  tools?: ToolDef[];
  handoffs?: string[];
  model?: string;
  mcpServers?: Record<string, McpServerConfig>;
}): AgentDef
```

## Parameters

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | Unique identifier for the agent |
| `description` | `string` | Yes | Human-readable description (shown to other agents during handoffs) |
| `prompt` | `string` | Yes | System prompt for the LLM |
| `tools` | [`ToolDef[]`](/api/types#tooldef) | No | Tools available to this agent |
| `handoffs` | `string[]` | No | Names of agents this agent can hand off to |
| `model` | `string` | No | Model override (provider-specific) |
| `mcpServers` | `Record<string, McpServerConfig>` | No | MCP server configurations |

## Returns

[`AgentDef`](/api/types#agentdef) — the agent definition object.

## Example

```typescript
import { defineAgent } from "one-agent-sdk";

const agent = defineAgent({
  name: "researcher",
  description: "Research agent that searches the web",
  prompt: "You are a research assistant. Use tools to find information.",
  tools: [searchTool],
  handoffs: ["math", "writer"],
});
```
