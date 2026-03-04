import type { StreamChunk, RunConfig } from "../types.js";

/** Provider interface — all backends implement this */
export interface Provider {
  run(prompt: string, config: RunConfig): AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}
