import { importProvider } from "../utils/import-provider.js";
import type {
  GetSessionMessagesOptions,
  ListSessionsOptions,
  SDKResultMessage,
  SDKSession,
  SDKSessionInfo,
  SDKSessionOptions,
  SessionMessage,
} from "./types.js";

const SDK_PKG = "@anthropic-ai/claude-agent-sdk";
const INSTALL_HINT = "bun add @anthropic-ai/claude-agent-sdk";

async function sdk(): Promise<any> {
  return importProvider(SDK_PKG, INSTALL_HINT);
}

/** List existing sessions. Requires @anthropic-ai/claude-agent-sdk. */
export async function listSessions(options?: ListSessionsOptions): Promise<SDKSessionInfo[]> {
  const s = await sdk();
  return s.listSessions(options);
}

/** Fetch messages from a session. Requires @anthropic-ai/claude-agent-sdk. */
export async function getSessionMessages(
  sessionId: string,
  options?: GetSessionMessagesOptions,
): Promise<SessionMessage[]> {
  const s = await sdk();
  return s.getSessionMessages(sessionId, options);
}

/** Create a new multi-turn session (v2 API, unstable). Requires @anthropic-ai/claude-agent-sdk. */
export async function unstable_v2_createSession(options: SDKSessionOptions): Promise<SDKSession> {
  const s = await sdk();
  return s.unstable_v2_createSession(options);
}

/** One-shot prompt (v2 API, unstable). Requires @anthropic-ai/claude-agent-sdk. */
export async function unstable_v2_prompt(
  message: string,
  options: SDKSessionOptions,
): Promise<SDKResultMessage> {
  const s = await sdk();
  return s.unstable_v2_prompt(message, options);
}

/** Resume an existing session (v2 API, unstable). Requires @anthropic-ai/claude-agent-sdk. */
export async function unstable_v2_resumeSession(
  sessionId: string,
  options: SDKSessionOptions,
): Promise<SDKSession> {
  const s = await sdk();
  return s.unstable_v2_resumeSession(sessionId, options);
}
