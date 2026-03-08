import type { StreamChunk } from "../types.js";

/** Partial SDKMessage — contains the fields consumers typically inspect. */
export type AdaptedMessage = { type: string; [key: string]: unknown };

/**
 * Adapt a StreamChunk async generator to emit SDKMessage-shaped objects
 * matching the @anthropic-ai/claude-agent-sdk output format.
 */
export async function* adaptStream(
  stream: AsyncGenerator<StreamChunk>,
): AsyncGenerator<AdaptedMessage> {
  const sessionId = crypto.randomUUID();

  yield { type: "system", subtype: "init", session_id: sessionId };

  for await (const chunk of stream) {
    switch (chunk.type) {
      case "text":
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: chunk.text }] },
        };
        break;
      case "tool_call":
        yield {
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                id: chunk.toolCallId,
                name: chunk.toolName,
                input: chunk.toolArgs,
              },
            ],
          },
        };
        break;
      case "tool_result":
        yield {
          type: "result",
          tool_use_id: chunk.toolCallId,
          content: chunk.result,
        };
        break;
      case "handoff":
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text: `[Handoff: ${chunk.fromAgent} → ${chunk.toAgent}]` }],
          },
        };
        break;
      case "error":
        yield {
          type: "result",
          subtype: "error_during_execution",
          error: chunk.error,
        };
        break;
      case "done":
        yield {
          type: "result",
          subtype: "success",
          text: chunk.text,
          usage: chunk.usage,
        };
        break;
    }
  }
}
