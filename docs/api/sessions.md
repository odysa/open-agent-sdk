# createSession()

Creates a session for multi-turn conversations with automatic history management.

## Signature

```typescript
function createSession(config?: SessionConfig): Session
```

## Parameters

### `config` (optional)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `sessionId` | `string` | No | Unique session ID. Auto-generated if not provided. |
| `store` | `SessionStore` | No | Storage backend. Defaults to `MemoryStore` (in-memory). |
| `runner` | `(prompt, config) => Promise<AgentRun>` | No | Custom runner function (for testing). |

## Returns

A `Session` object:

| Property/Method | Type | Description |
| --- | --- | --- |
| `id` | `string` | The session ID |
| `run(prompt, config)` | `Promise<AgentRun>` | Run with conversation history prepended |
| `getHistory()` | `Promise<Message[]>` | Retrieve conversation history |
| `clear()` | `Promise<void>` | Clear conversation history |

## Example

```typescript
import { createSession, defineAgent } from "one-agent-sdk";

const agent = defineAgent({
  name: "assistant",
  description: "A helpful assistant",
  prompt: "You are a helpful assistant.",
});

const session = createSession();

const { stream } = await session.run("My name is Alice.", {
  provider: "claude",
  agent,
});

for await (const chunk of stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}
```

## SessionStore Interface

Implement this interface for custom storage:

```typescript
interface SessionStore {
  load(sessionId: string): Promise<Message[]>;
  save(sessionId: string, messages: Message[]): Promise<void>;
}
```

## MemoryStore

The default in-memory store:

```typescript
import { MemoryStore } from "one-agent-sdk";

const store = new MemoryStore();
const session = createSession({ store });
```

## Message

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
}
```

## See Also

- [Sessions guide](/guide/sessions)
