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

      const originalStream = agentRun.stream;
      let assistantText = "";

      async function* wrappedStream(): AsyncGenerator<StreamChunk> {
        for await (const chunk of originalStream) {
          if (chunk.type === "text") {
            assistantText += chunk.text;
          }
          if (chunk.type === "done") {
            history.push({ role: "assistant", content: assistantText });
            await store.save(id, history);
          }
          yield chunk;
        }
      }

      return {
        stream: wrappedStream(),
        chat: agentRun.chat,
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
