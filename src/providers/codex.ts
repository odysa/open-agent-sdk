import type { RunConfig, StreamChunk } from "../types.js";
import type { ProviderBackend } from "./types.js";

export async function createCodexProvider(config: RunConfig): Promise<ProviderBackend> {
  let CodexClass: any;
  try {
    const mod = await import("@openai/codex-sdk");
    CodexClass = mod.Codex;
  } catch {
    throw new Error(
      "Codex provider requires @openai/codex-sdk. Install it with: bun add @openai/codex-sdk",
    );
  }

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

  async function* runPrompt(prompt: string): AsyncGenerator<StreamChunk> {
    const fullPrompt = config.agent.prompt
      ? `[System: ${config.agent.prompt}]\n\n${prompt}`
      : prompt;

    const { events } = await thread.runStreamed(fullPrompt, {
      signal: config.signal,
    });

    let fullText = "";

    for await (const event of events) {
      if (event.type === "item.completed" || event.type === "item.started") {
        const item = event.item;

        if (item.type === "agent_message") {
          fullText += item.text;
          yield { type: "text", text: item.text };
        }

        if (item.type === "mcp_tool_call") {
          yield {
            type: "tool_call",
            toolName: `${item.server}__${item.tool}`,
            toolArgs: (item.arguments as Record<string, unknown>) ?? {},
            toolCallId: item.id,
          };

          if (event.type === "item.completed") {
            const result = item.result
              ? item.result.content.map((c: any) => ("text" in c ? c.text : "")).join("")
              : (item.error?.message ?? "");
            yield { type: "tool_result", toolCallId: item.id, result };
          }
        }

        if (item.type === "command_execution" && event.type === "item.completed") {
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
        }

        if (item.type === "file_change" && event.type === "item.completed") {
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
        }

        if (item.type === "error") {
          yield { type: "error", error: item.message };
        }
      }

      if (event.type === "turn.completed") {
        yield {
          type: "done",
          text: fullText,
          usage: {
            inputTokens: event.usage.input_tokens,
            outputTokens: event.usage.output_tokens,
          },
        };
        return;
      }

      if (event.type === "turn.failed") {
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
