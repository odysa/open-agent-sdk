/**
 * one-agent-sdk — drop-in replacement for @anthropic-ai/claude-agent-sdk
 * with multi-provider support.
 *
 * Usage:
 *   import { query, tool, createSdkMcpServer } from "one-agent-sdk";
 *
 * 100% API-compatible with @anthropic-ai/claude-agent-sdk.
 * Pass `options.provider` to route to a different backend (codex, copilot, kimi-cli, or custom).
 * Defaults to claude-code when no provider is specified.
 */

// ── Anthropic-compatible API (primary) ──────────────────────────────────────

export * from "./sdk/claude-agent-sdk.js";

// ── Legacy API (deprecated — will be removed in v0.2) ───────────────────────

export { defineAgent } from "./agent.js";
export { run, runToCompletion } from "./runner.js";
export { defineTool } from "./tool.js";

// ── Internal types & utilities ──────────────────────────────────────────────

export type {
  FilterOptions,
  GuardrailsOptions,
  HooksOptions,
  LoggingOptions,
  TextCollectorHandle,
  TextCollectorOptions,
  TimingHandle,
  TimingInfo,
  TimingOptions,
  UsageStats,
  UsageTrackerHandle,
  UsageTrackerOptions,
} from "./middleware/index.js";
export {
  applyMiddleware,
  defineMiddleware,
  filter,
  guardrails,
  hooks,
  logging,
  textCollector,
  timing,
  usageTracker,
} from "./middleware/index.js";
export type { ProviderBackend } from "./providers/types.js";
export type { ProviderFactory } from "./registry.js";
export { clearProviders, registerProvider } from "./registry.js";
export type { Message, Session, SessionConfig, SessionStore } from "./session.js";
export { createSession, MemoryStore } from "./session.js";
export type {
  AgentDef,
  AgentRun,
  BuiltinProvider,
  Middleware,
  MiddlewareContext,
  Provider,
  RunConfig,
  StreamChunk,
  ToolDef,
} from "./types.js";

export { zodToJsonSchema } from "./utils/zod-to-jsonschema.js";
