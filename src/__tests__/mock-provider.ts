import type { ProviderBackend } from "../providers/types.js";
import type { RunConfig, StreamChunk } from "../types.js";

export type MockEvent = StreamChunk;

/** Create an async generator from an array of chunks */
export async function* fromChunks(chunks: StreamChunk[]): AsyncGenerator<StreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/** Collect all chunks from a stream */
export async function collect(stream: AsyncGenerator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

/** Collect only text from a stream */
export async function collectText(stream: AsyncGenerator<StreamChunk>): Promise<string> {
  let text = "";
  for await (const chunk of stream) {
    if (chunk.type === "text") text += chunk.text;
  }
  return text;
}

/**
 * Creates a mock provider that yields pre-configured events.
 * Use `setEvents` to configure what the next run/chat call returns.
 */
export function createMockProvider(initialEvents: MockEvent[] = []): {
  provider: ProviderBackend;
  setEvents(events: MockEvent[]): void;
  calls: { type: "run" | "chat"; prompt: string }[];
  closed: boolean;
} {
  let events = initialEvents;
  const calls: { type: "run" | "chat"; prompt: string }[] = [];
  let closed = false;

  function setEvents(newEvents: MockEvent[]) {
    events = newEvents;
  }

  async function* generate(prompt: string, type: "run" | "chat"): AsyncGenerator<StreamChunk> {
    calls.push({ type, prompt });
    for (const event of events) {
      yield event;
    }
  }

  const provider: ProviderBackend = {
    run(prompt: string, _config: RunConfig) {
      return generate(prompt, "run");
    },
    chat(message: string) {
      return generate(message, "chat");
    },
    async close() {
      closed = true;
    },
  };

  return {
    provider,
    setEvents,
    calls,
    get closed() {
      return closed;
    },
  };
}
