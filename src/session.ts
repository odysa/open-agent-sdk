import { run } from "./runner.js";
import type { AgentRun, RunConfig, StreamChunk } from "./types.js";

/** A message in the conversation history */
export interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Interface for session storage backends */
export interface SessionStore {
  load(sessionId: string): Promise<Message[]>;
  save(sessionId: string, messages: Message[]): Promise<void>;
}

/** In-memory session store */
export class MemoryStore implements SessionStore {
  private sessions = new Map<string, Message[]>();

  async load(sessionId: string): Promise<Message[]> {
    return this.sessions.get(sessionId) ?? [];
  }

  async save(sessionId: string, messages: Message[]): Promise<void> {
    this.sessions.set(sessionId, [...messages]);
  }
}

export interface SessionConfig {
  /** Unique session identifier. Auto-generated if not provided. */
  sessionId?: string;
  /** Storage backend. Defaults to in-memory. */
  store?: SessionStore;
  /** Custom runner function (for testing). Defaults to the SDK's run(). */
  runner?: (prompt: string, config: RunConfig) => Promise<AgentRun>;
}

export interface Session {
  /** The session ID */
  readonly id: string;
  /** Run a prompt with conversation history prepended */
  run(prompt: string, config: RunConfig): Promise<AgentRun>;
  /** Get conversation history */
  getHistory(): Promise<Message[]>;
  /** Clear conversation history */
  clear(): Promise<void>;
}

function wrapStreamWithHistory(
  stream: AsyncGenerator<StreamChunk>,
  history: Message[],
  store: SessionStore,
  sessionId: string,
): AsyncGenerator<StreamChunk> {
  let assistantText = "";

  async function* wrapped(): AsyncGenerator<StreamChunk> {
    for await (const chunk of stream) {
      if (chunk.type === "text") {
        assistantText += chunk.text;
      }
      if (chunk.type === "done") {
        // Prefer done.text if available (all built-in providers populate it)
        const text = chunk.text ?? assistantText;
        history.push({ role: "assistant", content: text });
        await store.save(sessionId, history);
      }
      yield chunk;
    }
  }

  return wrapped();
}

/** Create a session for multi-turn conversations */
export function createSession(config?: SessionConfig): Session {
  const id = config?.sessionId ?? crypto.randomUUID();
  const store = config?.store ?? new MemoryStore();
  const runner = config?.runner ?? run;

  return {
    id,

    async run(prompt: string, runConfig: RunConfig): Promise<AgentRun> {
      const history = await store.load(id);

      const historyContext = history
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const fullPrompt = historyContext
        ? `Previous conversation:\n${historyContext}\n\nUser: ${prompt}`
        : prompt;

      history.push({ role: "user", content: prompt });
      await store.save(id, history);

      const agentRun = await runner(fullPrompt, runConfig);

      return {
        stream: wrapStreamWithHistory(agentRun.stream, history, store, id),
        chat: (message: string) => {
          history.push({ role: "user", content: message });
          return wrapStreamWithHistory(agentRun.chat(message), history, store, id);
        },
        close: agentRun.close,
      };
    },

    async getHistory(): Promise<Message[]> {
      return store.load(id);
    },

    async clear(): Promise<void> {
      await store.save(id, []);
    },
  };
}
