import type { RunConfig, StreamChunk } from "../types.js";

/** Provider backend interface — all backends implement this */
export interface ProviderBackend {
  run(prompt: string, config: RunConfig): AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}
