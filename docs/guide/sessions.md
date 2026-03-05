# Sessions

Sessions manage multi-turn conversation history so agents can remember previous messages. The SDK tracks user and assistant messages automatically and prepends them to each new prompt.

## Creating a Session

```typescript
import { createSession } from "one-agent-sdk";

const session = createSession();
```

A random session ID is generated automatically. You can provide your own:

```typescript
const session = createSession({ sessionId: "user-123" });
```

## Multi-Turn Conversations

Use `session.run()` instead of `run()` — the API is the same, but conversation history is tracked:

```typescript
const first = await session.run("My name is Alice.", {
  provider: "claude",
  agent,
});
for await (const chunk of first.stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}

// The agent remembers the previous turn
const second = await session.run("What's my name?", {
  provider: "claude",
  agent,
});
for await (const chunk of second.stream) {
  if (chunk.type === "text") process.stdout.write(chunk.text);
}
```

## Session API

| Property/Method | Type | Description |
| --- | --- | --- |
| `id` | `string` | The session ID |
| `run(prompt, config)` | `Promise<AgentRun>` | Run with conversation history |
| `getHistory()` | `Promise<Message[]>` | Get conversation history |
| `clear()` | `Promise<void>` | Clear conversation history |

## Custom Storage

By default, sessions use in-memory storage (`MemoryStore`). Implement the `SessionStore` interface to persist history to a database, file system, or any other backend:

```typescript
import type { Message, SessionStore } from "one-agent-sdk";

class RedisStore implements SessionStore {
  async load(sessionId: string): Promise<Message[]> {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : [];
  }

  async save(sessionId: string, messages: Message[]): Promise<void> {
    await redis.set(`session:${sessionId}`, JSON.stringify(messages));
  }
}

const session = createSession({
  store: new RedisStore(),
});
```

## Message Format

Each message in the history has:

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
}
```

History is prepended to the prompt as formatted text. The assistant's response text is captured from the stream and saved automatically when a `done` chunk is received.
