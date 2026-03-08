/**
 * Type definitions matching @anthropic-ai/claude-agent-sdk.
 * These are our own definitions — no dependency on the Anthropic SDK for types.
 * External SDK types (BetaMessage, etc.) are defined as minimal compatible interfaces.
 */

import type { z } from "zod";

// ---------------------------------------------------------------------------
// External type stubs (minimal compatible definitions)
// ---------------------------------------------------------------------------

/** Minimal compatible type for Anthropic SDK's BetaMessage */
export type BetaMessage = {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: BetaUsage;
};

/** Minimal compatible type for Anthropic SDK's BetaUsage */
export type BetaUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** Minimal compatible type for Anthropic SDK's BetaRawMessageStreamEvent */
export type BetaRawMessageStreamEvent = {
  type: string;
  [key: string]: unknown;
};

/** Minimal compatible type for Anthropic SDK's MessageParam */
export type MessageParam = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

/** Content block in a message */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string | ContentBlock[] };

/** MCP CallToolResult */
export type CallToolResult = {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
};

/** MCP ToolAnnotations */
export type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

// ---------------------------------------------------------------------------
// Zod helpers
// ---------------------------------------------------------------------------

export type ZodRawShape = Record<string, z.ZodType>;
export type AnyZodRawShape = ZodRawShape;

export type InferShape<T extends AnyZodRawShape> = {
  [K in keyof T]: T[K] extends { _output: infer O } ? O : never;
} & {};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AbortError extends Error {}

// ---------------------------------------------------------------------------
// Permission types
// ---------------------------------------------------------------------------

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";
export type PermissionBehavior = "allow" | "deny" | "ask";

export type PermissionResult = {
  behavior: PermissionBehavior;
  updatedPermissions?: PermissionUpdate[];
};

export type PermissionUpdate = {
  tool: string;
  behavior: PermissionBehavior;
  destination: PermissionUpdateDestination;
  rule?: PermissionRuleValue;
};

export type PermissionUpdateDestination =
  | "userSettings"
  | "projectSettings"
  | "localSettings"
  | "session"
  | "cliArg";

export type PermissionRuleValue = {
  tool: string;
  behavior: PermissionBehavior;
  glob?: string;
  prefix?: string;
};

export type SDKPermissionDenial = {
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
};

export type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  },
) => Promise<PermissionResult>;

// ---------------------------------------------------------------------------
// Thinking
// ---------------------------------------------------------------------------

export type ThinkingAdaptive = { type: "adaptive" };
export type ThinkingEnabled = { type: "enabled"; budgetTokens?: number };
export type ThinkingDisabled = { type: "disabled" };
export type ThinkingConfig = ThinkingAdaptive | ThinkingEnabled | ThinkingDisabled;

// ---------------------------------------------------------------------------
// Model / Account
// ---------------------------------------------------------------------------

export type ModelInfo = {
  value: string;
  displayName: string;
  description: string;
  supportsEffort?: boolean;
  supportedEffortLevels?: ("low" | "medium" | "high" | "max")[];
  supportsAdaptiveThinking?: boolean;
  supportsFastMode?: boolean;
};

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
};

export type NonNullableUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

export type AccountInfo = {
  email?: string;
  organization?: string;
  subscriptionType?: string;
  tokenSource?: string;
  apiKeySource?: string;
};

export type FastModeState = "off" | "cooldown" | "on";
export type SDKStatus = "compacting" | null;
export type ApiKeySource = "user" | "project" | "org" | "temporary" | "oauth";

// ---------------------------------------------------------------------------
// Agent types
// ---------------------------------------------------------------------------

export type AgentDefinition = {
  description: string;
  tools?: string[];
  disallowedTools?: string[];
  prompt: string;
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  mcpServers?: AgentMcpServerSpec[];
  criticalSystemReminder_EXPERIMENTAL?: string;
  skills?: string[];
  maxTurns?: number;
};

export type AgentInfo = {
  name: string;
  description: string;
  model?: string;
};

export type AgentMcpServerSpec = string | Record<string, McpServerConfigForProcessTransport>;

// ---------------------------------------------------------------------------
// MCP types
// ---------------------------------------------------------------------------

export type McpStdioServerConfig = {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpSSEServerConfig = {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
};

export type McpHttpServerConfig = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
};

export type McpSdkServerConfig = {
  type: "sdk";
  name: string;
};

export type McpSdkServerConfigWithInstance = McpSdkServerConfig & {
  instance: unknown;
};

export type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfigWithInstance;

export type McpServerConfigForProcessTransport =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfig;

export type McpClaudeAIProxyServerConfig = {
  type: "claudeai-proxy";
  url: string;
  id: string;
};

export type McpServerStatusConfig =
  | McpServerConfigForProcessTransport
  | McpClaudeAIProxyServerConfig;

export type McpServerStatus = {
  name: string;
  status: "connected" | "failed" | "needs-auth" | "pending" | "disabled";
  serverInfo?: { name: string; version: string };
  error?: string;
  config?: McpServerStatusConfig;
  scope?: string;
  tools?: {
    name: string;
    description?: string;
    annotations?: { readOnly?: boolean; destructive?: boolean; openWorld?: boolean };
  }[];
};

export type McpSetServersResult = {
  added: string[];
  removed: string[];
  errors: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Tool types
// ---------------------------------------------------------------------------

export type SdkMcpToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> = {
  name: string;
  description: string;
  inputSchema: Schema;
  annotations?: ToolAnnotations;
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>;
};

export type CreateSdkMcpServerOptions = {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
};

export type ToolConfig = {
  askUserQuestion?: { previewFormat?: "markdown" | "html" };
};

// ---------------------------------------------------------------------------
// Hook types
// ---------------------------------------------------------------------------

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PermissionRequest"
  | "Setup"
  | "TeammateIdle"
  | "TaskCompleted"
  | "Elicitation"
  | "ElicitationResult"
  | "ConfigChange"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "InstructionsLoaded";

export const HOOK_EVENTS: readonly HookEvent[] = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PermissionRequest",
  "Setup",
  "TeammateIdle",
  "TaskCompleted",
  "Elicitation",
  "ElicitationResult",
  "ConfigChange",
  "WorktreeCreate",
  "WorktreeRemove",
  "InstructionsLoaded",
];

export type BaseHookInput = {
  session_id: string;
  transcript_path?: string;
};

export type HookInput = BaseHookInput & { type: HookEvent; [key: string]: unknown };
export type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;
export type AsyncHookJSONOutput = { async: true; asyncTimeout?: number };
export type SyncHookJSONOutput = {
  decision?: PermissionBehavior;
  reason?: string;
  suppressOutput?: boolean;
  [key: string]: unknown;
};

export type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal },
) => Promise<HookJSONOutput | undefined>;

export interface HookCallbackMatcher {
  matcher?: Record<string, unknown>;
  callback: HookCallback;
}

// Hook input subtypes (simplified — all extend BaseHookInput)
export type PreToolUseHookInput = BaseHookInput & {
  type: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  [key: string]: unknown;
};
export type PostToolUseHookInput = BaseHookInput & {
  type: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: unknown;
  [key: string]: unknown;
};
export type PostToolUseFailureHookInput = BaseHookInput & {
  type: "PostToolUseFailure";
  tool_name: string;
  error: string;
  [key: string]: unknown;
};
export type NotificationHookInput = BaseHookInput & {
  type: "Notification";
  message: string;
  [key: string]: unknown;
};
export type UserPromptSubmitHookInput = BaseHookInput & {
  type: "UserPromptSubmit";
  prompt: string;
  [key: string]: unknown;
};
export type SessionStartHookInput = BaseHookInput & {
  type: "SessionStart";
  [key: string]: unknown;
};
export type SessionEndHookInput = BaseHookInput & { type: "SessionEnd"; [key: string]: unknown };
export type StopHookInput = BaseHookInput & { type: "Stop"; [key: string]: unknown };
export type SubagentStartHookInput = BaseHookInput & {
  type: "SubagentStart";
  [key: string]: unknown;
};
export type SubagentStopHookInput = BaseHookInput & {
  type: "SubagentStop";
  [key: string]: unknown;
};
export type PreCompactHookInput = BaseHookInput & { type: "PreCompact"; [key: string]: unknown };
export type PermissionRequestHookInput = BaseHookInput & {
  type: "PermissionRequest";
  [key: string]: unknown;
};
export type SetupHookInput = BaseHookInput & { type: "Setup"; [key: string]: unknown };
export type TeammateIdleHookInput = BaseHookInput & {
  type: "TeammateIdle";
  [key: string]: unknown;
};
export type TaskCompletedHookInput = BaseHookInput & {
  type: "TaskCompleted";
  [key: string]: unknown;
};
export type ElicitationHookInput = BaseHookInput & { type: "Elicitation"; [key: string]: unknown };
export type ElicitationResultHookInput = BaseHookInput & {
  type: "ElicitationResult";
  [key: string]: unknown;
};
export type ConfigChangeHookInput = BaseHookInput & {
  type: "ConfigChange";
  [key: string]: unknown;
};
export type InstructionsLoadedHookInput = BaseHookInput & {
  type: "InstructionsLoaded";
  [key: string]: unknown;
};
export type WorktreeCreateHookInput = BaseHookInput & {
  type: "WorktreeCreate";
  [key: string]: unknown;
};
export type WorktreeRemoveHookInput = BaseHookInput & {
  type: "WorktreeRemove";
  [key: string]: unknown;
};

// Hook output subtypes (simplified)
export type PreToolUseHookSpecificOutput = {
  decision?: PermissionBehavior;
  reason?: string;
  [key: string]: unknown;
};
export type PostToolUseHookSpecificOutput = { [key: string]: unknown };
export type PostToolUseFailureHookSpecificOutput = { [key: string]: unknown };
export type NotificationHookSpecificOutput = { [key: string]: unknown };
export type UserPromptSubmitHookSpecificOutput = { [key: string]: unknown };
export type SessionStartHookSpecificOutput = { [key: string]: unknown };
export type SubagentStartHookSpecificOutput = { [key: string]: unknown };
export type PermissionRequestHookSpecificOutput = { [key: string]: unknown };
export type SetupHookSpecificOutput = { [key: string]: unknown };
export type ElicitationHookSpecificOutput = { [key: string]: unknown };
export type ElicitationResultHookSpecificOutput = { [key: string]: unknown };

// ---------------------------------------------------------------------------
// Elicitation / Prompt types
// ---------------------------------------------------------------------------

export type ElicitationRequest = {
  serverName: string;
  message: string;
  mode?: "form" | "url";
  url?: string;
  elicitationId?: string;
  requestedSchema?: Record<string, unknown>;
};

export type ElicitationResult = Record<string, unknown>;

export type OnElicitation = (
  request: ElicitationRequest,
  options: { signal: AbortSignal },
) => Promise<ElicitationResult>;

export type PromptRequest = {
  prompt: string;
  message: string;
  options: PromptRequestOption[];
};

export type PromptRequestOption = {
  key: string;
  label: string;
  description?: string;
};

export type PromptResponse = {
  prompt_response: string;
  selected: string;
};

// ---------------------------------------------------------------------------
// Output format
// ---------------------------------------------------------------------------

export type OutputFormatType = "json_schema";
export type BaseOutputFormat = { type: OutputFormatType };
export type JsonSchemaOutputFormat = { type: "json_schema"; schema: Record<string, unknown> };
export type OutputFormat = JsonSchemaOutputFormat;

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

export type SDKSessionInfo = {
  sessionId: string;
  summary: string;
  lastModified: number;
  fileSize: number;
  customTitle?: string;
  firstPrompt?: string;
  gitBranch?: string;
  cwd?: string;
};

export type SDKSessionOptions = {
  model: string;
  pathToClaudeCodeExecutable?: string;
  executable?: "node" | "bun";
  executableArgs?: string[];
  env?: { [envVar: string]: string | undefined };
  allowedTools?: string[];
  disallowedTools?: string[];
  canUseTool?: CanUseTool;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  permissionMode?: PermissionMode;
};

export interface SDKSession {
  readonly sessionId: string;
  send(message: string | SDKUserMessage): Promise<void>;
  stream(): AsyncGenerator<SDKMessage, void>;
  close(): void;
  [Symbol.asyncDispose](): Promise<void>;
}

export type SessionMessage = {
  type: "user" | "assistant";
  uuid: string;
  session_id: string;
  message: unknown;
  parent_tool_use_id: null;
};

export type ListSessionsOptions = {
  dir?: string;
  limit?: number;
  includeWorktrees?: boolean;
};

export type GetSessionMessagesOptions = {
  dir?: string;
  limit?: number;
  offset?: number;
};

// ---------------------------------------------------------------------------
// Settings / Config types
// ---------------------------------------------------------------------------

export type ConfigScope = "local" | "user" | "project";
export type SettingSource = "user" | "project" | "local";

export interface Settings {
  [key: string]: unknown;
}

export type SandboxSettings = Record<string, unknown>;
export type SandboxFilesystemConfig = Record<string, unknown>;
export type SandboxNetworkConfig = Record<string, unknown>;
export type SandboxIgnoreViolations = string[];

export type SdkBeta = "context-1m-2025-08-07";

export type SdkPluginConfig = {
  type: "local";
  path: string;
};

export type SlashCommand = {
  name: string;
  description: string;
  argumentHint: string;
};

export type RewindFilesResult = {
  canRewind: boolean;
  error?: string;
  filesChanged?: string[];
  insertions?: number;
  deletions?: number;
};

export interface SpawnOptions {
  command: string;
  args: string[];
  env: Record<string, string | undefined>;
  cwd: string;
}

export interface SpawnedProcess {
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  stdin: { write(data: string): void; end(): void };
  kill(signal?: string): void;
  exitCode: Promise<number | null>;
}

export interface Transport {
  start(): Promise<void>;
  send(message: unknown): Promise<void>;
  close(): Promise<void>;
}

export type ExitReason =
  | "clear"
  | "logout"
  | "prompt_input_exit"
  | "other"
  | "bypass_permissions_disabled";

export const EXIT_REASONS: readonly ExitReason[] = [
  "clear",
  "logout",
  "prompt_input_exit",
  "other",
  "bypass_permissions_disabled",
];

// ---------------------------------------------------------------------------
// SDK Message types
// ---------------------------------------------------------------------------

export type SDKAssistantMessageError =
  | "authentication_failed"
  | "billing_error"
  | "rate_limit"
  | "invalid_request"
  | "server_error"
  | "unknown"
  | "max_output_tokens";

export type SDKAssistantMessage = {
  type: "assistant";
  message: BetaMessage;
  parent_tool_use_id: string | null;
  error?: SDKAssistantMessageError;
  uuid: string;
  session_id: string;
};

export type SDKUserMessage = {
  type: "user";
  message: MessageParam;
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
  priority?: "now" | "next" | "later";
  uuid?: string;
  session_id: string;
};

export type SDKUserMessageReplay = SDKUserMessage & { isReplay: true; uuid: string };

export type SDKResultSuccess = {
  type: "result";
  subtype: "success";
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;
  stop_reason: string | null;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: Record<string, ModelUsage>;
  permission_denials: SDKPermissionDenial[];
  structured_output?: unknown;
  fast_mode_state?: FastModeState;
  uuid: string;
  session_id: string;
};

export type SDKResultError = {
  type: "result";
  subtype:
    | "error_during_execution"
    | "error_max_turns"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  stop_reason: string | null;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: Record<string, ModelUsage>;
  permission_denials: SDKPermissionDenial[];
  errors: string[];
  fast_mode_state?: FastModeState;
  uuid: string;
  session_id: string;
};

export type SDKResultMessage = SDKResultSuccess | SDKResultError;

export type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  agents?: string[];
  apiKeySource: ApiKeySource;
  betas?: string[];
  claude_code_version: string;
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  output_style: string;
  skills: string[];
  plugins: { name: string; path: string }[];
  fast_mode_state?: FastModeState;
  uuid: string;
  session_id: string;
};

export type SDKPartialAssistantMessage = {
  type: "stream_event";
  event: BetaRawMessageStreamEvent;
  parent_tool_use_id: string | null;
  uuid: string;
  session_id: string;
};

export type SDKCompactBoundaryMessage = {
  type: "system";
  subtype: "compact_boundary";
  compact_metadata: { trigger: "manual" | "auto"; pre_tokens: number };
  uuid: string;
  session_id: string;
};

export type SDKStatusMessage = {
  type: "system";
  subtype: "status";
  status: SDKStatus;
  permissionMode?: PermissionMode;
  uuid: string;
  session_id: string;
};

export type SDKLocalCommandOutputMessage = {
  type: "system";
  subtype: "local_command_output";
  content: string;
  uuid: string;
  session_id: string;
};

export type SDKHookStartedMessage = {
  type: "system";
  subtype: "hook_started";
  hook_id: string;
  hook_name: string;
  hook_event: string;
  uuid: string;
  session_id: string;
};

export type SDKHookProgressMessage = {
  type: "system";
  subtype: "hook_progress";
  hook_id: string;
  hook_name: string;
  hook_event: string;
  stdout: string;
  stderr: string;
  output: string;
  uuid: string;
  session_id: string;
};

export type SDKHookResponseMessage = {
  type: "system";
  subtype: "hook_response";
  hook_id: string;
  hook_name: string;
  hook_event: string;
  output: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
  outcome: "success" | "error" | "cancelled";
  uuid: string;
  session_id: string;
};

export type SDKToolProgressMessage = {
  type: "tool_progress";
  tool_use_id: string;
  tool_name: string;
  parent_tool_use_id: string | null;
  elapsed_time_seconds: number;
  task_id?: string;
  uuid: string;
  session_id: string;
};

export type SDKAuthStatusMessage = {
  type: "auth_status";
  isAuthenticating: boolean;
  output: string[];
  error?: string;
  uuid: string;
  session_id: string;
};

export type SDKTaskNotificationMessage = {
  type: "system";
  subtype: "task_notification";
  task_id: string;
  tool_use_id?: string;
  status: "completed" | "failed" | "stopped";
  output_file: string;
  summary: string;
  usage?: { total_tokens: number; tool_uses: number; duration_ms: number };
  uuid: string;
  session_id: string;
};

export type SDKTaskStartedMessage = {
  type: "system";
  subtype: "task_started";
  task_id: string;
  tool_use_id?: string;
  description: string;
  task_type?: string;
  prompt?: string;
  uuid: string;
  session_id: string;
};

export type SDKTaskProgressMessage = {
  type: "system";
  subtype: "task_progress";
  task_id: string;
  tool_use_id?: string;
  description: string;
  usage: { total_tokens: number; tool_uses: number; duration_ms: number };
  last_tool_name?: string;
  uuid: string;
  session_id: string;
};

export type SDKFilesPersistedEvent = {
  type: "system";
  subtype: "files_persisted";
  files: { filename: string; file_id: string }[];
  failed: { filename: string; error: string }[];
  processed_at: string;
  uuid: string;
  session_id: string;
};

export type SDKToolUseSummaryMessage = {
  type: "tool_use_summary";
  summary: string;
  preceding_tool_use_ids: string[];
  uuid: string;
  session_id: string;
};

export type SDKRateLimitInfo = {
  status: "allowed" | "allowed_warning" | "rejected";
  resetsAt?: number;
  rateLimitType?: "five_hour" | "seven_day" | "seven_day_opus" | "seven_day_sonnet" | "overage";
  utilization?: number;
  overageStatus?: "allowed" | "allowed_warning" | "rejected";
  overageResetsAt?: number;
  overageDisabledReason?: string;
  isUsingOverage?: boolean;
  surpassedThreshold?: number;
};

export type SDKRateLimitEvent = {
  type: "rate_limit_event";
  rate_limit_info: SDKRateLimitInfo;
  uuid: string;
  session_id: string;
};

export type SDKElicitationCompleteMessage = {
  type: "system";
  subtype: "elicitation_complete";
  mcp_server_name: string;
  elicitation_id: string;
  uuid: string;
  session_id: string;
};

export type SDKPromptSuggestionMessage = {
  type: "prompt_suggestion";
  suggestion: string;
  uuid: string;
  session_id: string;
};

/** Union of all SDK message types emitted by query() */
export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage
  | SDKStatusMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKFilesPersistedEvent
  | SDKToolUseSummaryMessage
  | SDKRateLimitEvent
  | SDKElicitationCompleteMessage
  | SDKPromptSuggestionMessage;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type Options = {
  abortController?: AbortController;
  additionalDirectories?: string[];
  agent?: string;
  agents?: Record<string, AgentDefinition>;
  allowedTools?: string[];
  canUseTool?: CanUseTool;
  continue?: boolean;
  cwd?: string;
  disallowedTools?: string[];
  tools?: string[] | { type: "preset"; preset: "claude_code" };
  env?: { [envVar: string]: string | undefined };
  executable?: "bun" | "deno" | "node";
  executableArgs?: string[];
  extraArgs?: Record<string, string | null>;
  fallbackModel?: string;
  enableFileCheckpointing?: boolean;
  toolConfig?: ToolConfig;
  forkSession?: boolean;
  betas?: SdkBeta[];
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  onElicitation?: OnElicitation;
  persistSession?: boolean;
  includePartialMessages?: boolean;
  thinking?: ThinkingConfig;
  effort?: "low" | "medium" | "high" | "max";
  maxThinkingTokens?: number;
  maxTurns?: number;
  maxBudgetUsd?: number;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  outputFormat?: OutputFormat;
  pathToClaudeCodeExecutable?: string;
  permissionMode?: PermissionMode;
  allowDangerouslySkipPermissions?: boolean;
  permissionPromptToolName?: string;
  plugins?: SdkPluginConfig[];
  promptSuggestions?: boolean;
  resume?: string;
  sessionId?: string;
  resumeSessionAt?: string;
  sandbox?: SandboxSettings;
  settings?: string | Settings;
  settingSources?: SettingSource[];
  debug?: boolean;
  debugFile?: string;
  stderr?: (data: string) => void;
  strictMcpConfig?: boolean;
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
  spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
  /** Provider routing (one-agent-sdk extension). Defaults to "claude-code". */
  provider?: string;
};

// ---------------------------------------------------------------------------
// Query interface
// ---------------------------------------------------------------------------

export type SDKControlInitializeResponse = {
  commands: SlashCommand[];
  agents: AgentInfo[];
  output_style: string;
  available_output_styles: string[];
  models: ModelInfo[];
  account: AccountInfo;
  fast_mode_state?: FastModeState;
};

export interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  supportedAgents(): Promise<AgentInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>;
  reconnectMcpServer(serverName: string): Promise<void>;
  toggleMcpServer(serverName: string, enabled: boolean): Promise<void>;
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  close(): void;
}
