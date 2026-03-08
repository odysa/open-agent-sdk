import type { AgentDef, RunConfig, StreamChunk } from "../types.js";
import { handoffToolName, parseHandoff } from "../utils/handoff.js";
import { importProvider } from "../utils/import-provider.js";
import { buildToolMap } from "../utils/tool-map.js";
import { zodToJsonSchema } from "../utils/zod-to-jsonschema.js";
import type { ProviderBackend } from "./types.js";

function buildTools(agent: AgentDef, agents?: Record<string, AgentDef>) {
  const tools: Record<string, unknown>[] = [];

  for (const t of agent.tools ?? []) {
    tools.push({
      name: t.name,
      description: t.description,
      input_schema: zodToJsonSchema(t.parameters),
    });
  }

  for (const name of agent.handoffs ?? []) {
    const target = agents?.[name];
    tools.push({
      name: handoffToolName(name),
      description: target
        ? `Hand off to ${target.name}: ${target.description}`
        : `Hand off to ${name}`,
      input_schema: { type: "object", properties: {} },
    });
  }

  return tools;
}

export async function createAnthropicProvider(config: RunConfig): Promise<ProviderBackend> {
  const mod = await importProvider("@anthropic-ai/sdk", "bun add @anthropic-ai/sdk");
  const Anthropic = mod.default ?? mod.Anthropic ?? mod;
  const opts = (config.providerOptions ?? {}) as Record<string, unknown>;

  const client = new Anthropic({
    apiKey: (opts.apiKey as string) ?? process.env.ANTHROPIC_API_KEY,
  });

  let activeAgent = config.agent;
  let toolMap = buildToolMap(activeAgent);
  let tools = buildTools(activeAgent, config.agents);
  const messages: Record<string, unknown>[] = [];
  const maxTokens = (opts.maxTokens as number) ?? 8192;

  function swapAgent(agent: AgentDef) {
    activeAgent = agent;
    toolMap = buildToolMap(activeAgent);
    tools = buildTools(activeAgent, config.agents);
  }

  async function* runStream(signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const maxTurns = config.maxTurns ?? 100;

    for (let turn = 0; turn < maxTurns; turn++) {
      const model = activeAgent.model ?? "claude-sonnet-4-20250514";

      const stream = await client.messages.create({
        model,
        system: activeAgent.prompt,
        messages,
        max_tokens: maxTokens,
        ...(tools.length > 0 ? { tools } : {}),
        stream: true,
        signal,
      });

      let fullText = "";
      const contentBlocks: Record<string, unknown>[] = [];
      let currentToolUse: { id: string; name: string; jsonInput: string } | null = null;
      let stopReason: string | null = null;
      let usage: { inputTokens: number; outputTokens: number } | undefined;

      for await (const event of stream) {
        switch (event.type) {
          case "message_start": {
            if (event.message?.usage) {
              usage = {
                inputTokens: event.message.usage.input_tokens ?? 0,
                outputTokens: event.message.usage.output_tokens ?? 0,
              };
            }
            break;
          }
          case "content_block_start": {
            if (event.content_block?.type === "tool_use") {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                jsonInput: "",
              };
            }
            break;
          }
          case "content_block_delta": {
            if (event.delta?.type === "text_delta") {
              fullText += event.delta.text;
              yield { type: "text", text: event.delta.text };
            } else if (event.delta?.type === "input_json_delta" && currentToolUse) {
              currentToolUse.jsonInput += event.delta.partial_json;
            }
            break;
          }
          case "content_block_stop": {
            if (currentToolUse) {
              contentBlocks.push({
                type: "tool_use",
                id: currentToolUse.id,
                name: currentToolUse.name,
                input: currentToolUse.jsonInput ? JSON.parse(currentToolUse.jsonInput) : {},
              });
              currentToolUse = null;
            } else {
              contentBlocks.push({ type: "text", text: fullText });
            }
            break;
          }
          case "message_delta": {
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
            if (event.usage) {
              usage = {
                inputTokens: (usage?.inputTokens ?? 0) + (event.usage.input_tokens ?? 0),
                outputTokens: (usage?.outputTokens ?? 0) + (event.usage.output_tokens ?? 0),
              };
            }
            break;
          }
        }
      }

      // Add assistant message
      messages.push({
        role: "assistant",
        content: contentBlocks.length > 0 ? contentBlocks : fullText,
      });

      if (stopReason !== "tool_use") {
        yield { type: "done", text: fullText, usage };
        return;
      }

      // Process tool calls
      const toolUseBlocks = contentBlocks.filter((b) => b.type === "tool_use") as {
        id: string;
        name: string;
        input: Record<string, unknown>;
      }[];
      const toolResults: Record<string, unknown>[] = [];

      for (const block of toolUseBlocks) {
        yield {
          type: "tool_call",
          toolName: block.name,
          toolArgs: block.input,
          toolCallId: block.id,
        };

        const handoffTarget = parseHandoff(block.name);
        if (handoffTarget) {
          const targetAgent = config.agents?.[handoffTarget];
          if (!targetAgent) {
            yield { type: "error", error: `Unknown handoff target: ${handoffTarget}` };
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: unknown agent "${handoffTarget}"`,
            });
            continue;
          }

          yield { type: "handoff", fromAgent: activeAgent.name, toAgent: handoffTarget };
          swapAgent(targetAgent);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Handed off to ${handoffTarget}`,
          });
          continue;
        }

        const tool = toolMap.get(block.name);
        if (!tool) {
          const errorResult = `Error: unknown tool "${block.name}"`;
          yield { type: "tool_result", toolCallId: block.id, result: errorResult };
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: errorResult,
          });
          continue;
        }

        try {
          const result = await tool.handler(block.input);
          yield { type: "tool_result", toolCallId: block.id, result };
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        } catch (err) {
          const errorResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
          yield { type: "tool_result", toolCallId: block.id, result: errorResult };
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: errorResult,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    yield { type: "error", error: `Max turns (${config.maxTurns ?? 100}) exceeded` };
    yield { type: "done" };
  }

  return {
    run(prompt: string, cfg: RunConfig) {
      messages.push({ role: "user", content: prompt });
      return runStream(cfg.signal);
    },
    chat(message: string) {
      messages.push({ role: "user", content: message });
      return runStream(config.signal);
    },
    async close() {},
  };
}
