import type { RunConfig, StreamChunk } from "../types.js";
import { importProvider } from "../utils/import-provider.js";
import type { ProviderBackend } from "./types.js";

export async function createCodexProvider(config: RunConfig): Promise<ProviderBackend> {
  const { Codex: CodexClass } = await importProvider(
    "@openai/codex-sdk",
    "bun add @openai/codex-sdk",
  );

  const codex = new CodexClass({
    apiKey: config.providerOptions?.apiKey as string | undefined,
    ...(config.providerOptions?.codexOptions as Record<string, unknown> | undefined),
  });

  const thread = codex.startThread({
    model: config.agent.model,
    workingDirectory: config.workDir ?? process.cwd(),
    approvalPolicy: "never",
    ...(config.providerOptions?.threadOptions as Record<string, unknown> | undefined),
  });

  const systemPrefix = config.agent.prompt ? `[System: ${config.agent.prompt}]\n\n` : "";

  async function* runPrompt(prompt: string): AsyncGenerator<StreamChunk> {
    const { events } = await thread.runStreamed(`${systemPrefix}${prompt}`, {
      signal: config.signal,
    });

    let fullText = "";

    for await (const event of events) {
      switch (event.type) {
        case "item.completed": {
          const item = event.item;
          switch (item.type) {
            case "agent_message":
              fullText += item.text;
              yield { type: "text", text: item.text };
              break;
            case "mcp_tool_call":
              yield {
                type: "tool_call",
                toolName: `${item.server}__${item.tool}`,
                toolArgs: (item.arguments as Record<string, unknown>) ?? {},
                toolCallId: item.id,
              };
              yield {
                type: "tool_result",
                toolCallId: item.id,
                result: item.result
                  ? item.result.content.map((c: any) => ("text" in c ? c.text : "")).join("")
                  : (item.error?.message ?? ""),
              };
              break;
            case "command_execution":
              yield {
                type: "tool_call",
                toolName: "command_execution",
                toolArgs: { command: item.command },
                toolCallId: item.id,
              };
              yield {
                type: "tool_result",
                toolCallId: item.id,
                result: item.aggregated_output,
              };
              break;
            case "file_change":
              yield {
                type: "tool_call",
                toolName: "file_change",
                toolArgs: { changes: item.changes },
                toolCallId: item.id,
              };
              yield {
                type: "tool_result",
                toolCallId: item.id,
                result: item.status,
              };
              break;
            case "error":
              yield { type: "error", error: item.message };
              yield { type: "done", text: fullText };
              return;
          }
          break;
        }
        case "turn.completed":
          yield {
            type: "done",
            text: fullText,
            usage: {
              inputTokens: event.usage.input_tokens,
              outputTokens: event.usage.output_tokens,
            },
          };
          return;
        case "turn.failed":
          yield { type: "error", error: event.error.message };
          yield { type: "done", text: fullText };
          return;
      }
    }

    yield { type: "done", text: fullText };
  }

  return {
    run: runPrompt,
    chat: runPrompt,
    async close() {},
  };
}
