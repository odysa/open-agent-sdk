import type { RunConfig, AgentRun } from "./types.js";
/** Start a run — returns a stream, chat handle, and close function */
export declare function run(prompt: string, config: RunConfig): Promise<AgentRun>;
/** Convenience: run to completion and return collected text */
export declare function runToCompletion(prompt: string, config: RunConfig): Promise<string>;
