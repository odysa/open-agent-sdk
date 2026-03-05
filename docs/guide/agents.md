# Agents

An agent is defined using `defineAgent()` and describes an LLM persona with a system prompt, tools, and optional handoff targets.

## Defining an Agent

```typescript
import { defineAgent } from "one-agent-sdk";

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant.",
  tools: [weatherTool, searchTool],
  handoffs: ["specialist"],
  model: "claude-sonnet-4-20250514",
});
```

## AgentDef Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | Unique identifier for the agent |
| `description` | `string` | Yes | Human-readable description |
| `prompt` | `string` | Yes | System prompt for the LLM |
| `tools` | `ToolDef[]` | No | Tools available to the agent |
| `handoffs` | `string[]` | No | Names of agents this agent can hand off to |
| `model` | `string` | No | Model override (provider-specific) |
| `mcpServers` | `Record<string, McpServerConfig>` | No | MCP server configurations |

## MCP Servers

Agents can connect to MCP (Model Context Protocol) servers for additional tool access:

```typescript
const agent = defineAgent({
  name: "assistant",
  description: "An assistant with filesystem access",
  prompt: "You are a helpful assistant with access to the filesystem.",
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    },
  },
});
```

The `McpServerConfig` supports:

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `string` | Yes | Command to launch the server |
| `args` | `string[]` | No | Command arguments |
| `env` | `Record<string, string>` | No | Environment variables |
| `url` | `string` | No | URL for remote MCP servers |
