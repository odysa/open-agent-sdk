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

export {
  getSessionMessages,
  listSessions,
  unstable_v2_createSession,
  unstable_v2_prompt,
  unstable_v2_resumeSession,
} from "./compat/delegates.js";
export { createSdkMcpServer } from "./compat/mcp-server.js";
// Functions
export { query } from "./compat/query.js";
export { tool } from "./compat/tool.js";
// Types (148 exports matching @anthropic-ai/claude-agent-sdk)
// Re-export McpServerConfig from compat (shadows the internal one)
export type {
  AbortError,
  AccountInfo,
  AgentDefinition,
  AgentInfo,
  AgentMcpServerSpec,
  AnyZodRawShape,
  ApiKeySource,
  AsyncHookJSONOutput,
  BaseHookInput,
  BaseOutputFormat,
  BetaMessage,
  BetaRawMessageStreamEvent,
  BetaUsage,
  CallToolResult,
  CanUseTool,
  ConfigChangeHookInput,
  ConfigScope,
  ContentBlock,
  CreateSdkMcpServerOptions,
  ElicitationHookInput,
  ElicitationHookSpecificOutput,
  ElicitationRequest,
  ElicitationResult,
  ElicitationResultHookInput,
  ElicitationResultHookSpecificOutput,
  ExitReason,
  FastModeState,
  GetSessionMessagesOptions,
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
  HookInput,
  HookJSONOutput,
  InferShape,
  InstructionsLoadedHookInput,
  JsonSchemaOutputFormat,
  ListSessionsOptions,
  McpClaudeAIProxyServerConfig,
  McpHttpServerConfig,
  McpSdkServerConfig,
  McpSdkServerConfigWithInstance,
  McpServerConfig,
  McpServerConfigForProcessTransport,
  McpServerStatus,
  McpServerStatusConfig,
  McpSetServersResult,
  McpSSEServerConfig,
  McpStdioServerConfig,
  MessageParam,
  ModelInfo,
  ModelUsage,
  NonNullableUsage,
  NotificationHookInput,
  NotificationHookSpecificOutput,
  OnElicitation,
  Options,
  OutputFormat,
  OutputFormatType,
  PermissionBehavior,
  PermissionMode,
  PermissionRequestHookInput,
  PermissionRequestHookSpecificOutput,
  PermissionResult,
  PermissionRuleValue,
  PermissionUpdate,
  PermissionUpdateDestination,
  PostToolUseFailureHookInput,
  PostToolUseFailureHookSpecificOutput,
  PostToolUseHookInput,
  PostToolUseHookSpecificOutput,
  PreCompactHookInput,
  PreToolUseHookInput,
  PreToolUseHookSpecificOutput,
  PromptRequest,
  PromptRequestOption,
  PromptResponse,
  Query,
  RewindFilesResult,
  SandboxFilesystemConfig,
  SandboxIgnoreViolations,
  SandboxNetworkConfig,
  SandboxSettings,
  SDKAssistantMessage,
  SDKAssistantMessageError,
  SDKAuthStatusMessage,
  SDKCompactBoundaryMessage,
  SDKControlInitializeResponse,
  SDKElicitationCompleteMessage,
  SDKFilesPersistedEvent,
  SDKHookProgressMessage,
  SDKHookResponseMessage,
  SDKHookStartedMessage,
  SDKLocalCommandOutputMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKPermissionDenial,
  SDKPromptSuggestionMessage,
  SDKRateLimitEvent,
  SDKRateLimitInfo,
  SDKResultError,
  SDKResultMessage,
  SDKResultSuccess,
  SDKSession,
  SDKSessionInfo,
  SDKSessionOptions,
  SDKStatus,
  SDKStatusMessage,
  SDKSystemMessage,
  SDKTaskNotificationMessage,
  SDKTaskProgressMessage,
  SDKTaskStartedMessage,
  SDKToolProgressMessage,
  SDKToolUseSummaryMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
  SdkBeta,
  SdkMcpToolDefinition,
  SdkPluginConfig,
  SessionEndHookInput,
  SessionMessage,
  SessionStartHookInput,
  SessionStartHookSpecificOutput,
  SettingSource,
  Settings,
  SetupHookInput,
  SetupHookSpecificOutput,
  SlashCommand,
  SpawnedProcess,
  SpawnOptions,
  StopHookInput,
  SubagentStartHookInput,
  SubagentStartHookSpecificOutput,
  SubagentStopHookInput,
  SyncHookJSONOutput,
  TaskCompletedHookInput,
  TeammateIdleHookInput,
  ThinkingAdaptive,
  ThinkingConfig,
  ThinkingDisabled,
  ThinkingEnabled,
  ToolAnnotations,
  ToolConfig,
  Transport,
  UserPromptSubmitHookInput,
  UserPromptSubmitHookSpecificOutput,
  WorktreeCreateHookInput,
  WorktreeRemoveHookInput,
  ZodRawShape,
} from "./compat/types.js";
// Constants
export { EXIT_REASONS, HOOK_EVENTS } from "./compat/types.js";

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
