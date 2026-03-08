# Sessions Spec

Defines the `Session` interface, `SessionStore`, and history construction.

**Source:** `src/session.ts`

## Interface

```ts
interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SessionStore {
  load(sessionId: string): Promise<Message[]>;
  save(sessionId: string, messages: Message[]): Promise<void>;
}

interface Session {
  readonly id: string;
  run(prompt: string, config: RunConfig): Promise<AgentRun>;
  getHistory(): Promise<Message[]>;
  clear(): Promise<void>;
}

interface SessionConfig {
  sessionId?: string;
  store?: SessionStore;
  runner?: (prompt: string, config: RunConfig) => Promise<AgentRun>;
}

class MemoryStore implements SessionStore { ... }
function createSession(config?: SessionConfig): Session;
```

## Behavior

### `createSession(config?)`

1. Generates a UUID for `id` if `sessionId` is not provided.
2. Defaults to `MemoryStore` if `store` is not provided.
3. Defaults to the SDK's `run()` if `runner` is not provided.
4. Returns a `Session` object.

### `Session.run(prompt, config)`

1. Loads history from the store.
2. Builds `fullPrompt` by prepending history as formatted text:
   ```
   Previous conversation:
   User: ...
   Assistant: ...

   User: {prompt}
   ```
3. Pushes `{ role: "user", content: prompt }` to history and saves immediately.
4. Calls the runner with `fullPrompt`.
5. Wraps the returned stream to capture assistant text on completion.
6. On `done` chunk: pushes `{ role: "assistant", content }` to history and saves. Uses `done.text` if available, otherwise falls back to concatenated `text` chunks.

### `Session.chat(message)` (via `AgentRun.chat`)

Same history-capture wrapping as `run()`. The user message is pushed to history before returning the wrapped stream.

### `MemoryStore`

In-memory `Map<string, Message[]>`. `save` stores a shallow copy of the array. Not persistent across process restarts.

## Invariants

1. History MUST be saved after every user message (before the LLM responds) and after every assistant response.
2. `done.text` SHOULD be preferred over concatenated text chunks for the assistant message, since providers may have a more authoritative source.
3. `Session.id` MUST be stable for the lifetime of the session object.
4. `MemoryStore.save` MUST store a copy, not a reference, to prevent external mutation.
5. `clear()` MUST save an empty array, not delete the key.

## Error handling

- If `store.load` throws, the error propagates from `Session.run()`.
- If `store.save` throws during stream wrapping (on `done`), the error propagates to the stream consumer.
- Runner errors propagate directly to the caller.

## Edge cases

- First run with no history: `fullPrompt` equals the raw `prompt` (no "Previous conversation" prefix).
- `getHistory()` returns a snapshot — modifying the returned array does not affect stored history.
- Calling `run()` concurrently on the same session is not safe — history may interleave. Callers SHOULD serialize calls.
- `createSession()` with no arguments is valid — generates an ID and uses in-memory storage.
