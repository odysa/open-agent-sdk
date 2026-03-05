# run()

Starts a streaming agent run.

## Signature

```typescript
function run(prompt: string, config: RunConfig): Promise<AgentRun>
```

## Parameters

### `prompt`

- **Type:** `string`
- The user message to send to the agent.

### `config`

- **Type:** [`RunConfig`](/api/types#runconfig)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `provider` | `"claude" \| "codex" \| "kimi"` | Yes | Backend provider |
| `agent` | [`AgentDef`](/api/types#agentdef) | Yes | The agent definition |
| `agents` | `Record<string, AgentDef>` | No | Agent map for handoffs |
| `mcpServers` | `Record<string, McpServerConfig>` | No | MCP server configs |
| `providerOptions` | `Record<string, unknown>` | No | Provider-specific options |
| `workDir` | `string` | No | Working directory |
| `maxTurns` | `number` | No | Limit tool-use turns |
| `signal` | `AbortSignal` | No | Cancellation signal |

## Returns

`Promise<AgentRun>` with the following properties:

| Property | Type | Description |
| --- | --- | --- |
| `stream` | `AsyncGenerator<StreamChunk>` | Stream of events |
| `chat` | `(message: string) => AsyncGenerator<StreamChunk>` | Send a follow-up message |
| `close` | `() => Promise<void>` | Clean up resources |

## Example

```typescript
import { defineAgent, run } from "one-agent-sdk";

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant.",
});

const { stream, chat, close } = await run("Hello!", {
  provider: "claude",
  agent,
});

for await (const chunk of stream) {
  if (chunk.type === "text") {
    process.stdout.write(chunk.text);
  }
}

await close();
```
