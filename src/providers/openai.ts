import type { AgentDef, RunConfig, StreamChunk } from "../types.js";
import { handoffToolName, parseHandoff } from "../utils/handoff.js";
import { importProvider } from "../utils/import-provider.js";
import { buildToolMap } from "../utils/tool-map.js";
import { zodToJsonSchema } from "../utils/zod-to-jsonschema.js";
import type { ProviderBackend } from "./types.js";

interface OpenAICompatibleOptions {
  apiKey: string;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  providerOptions?: Record<string, unknown>;
}

function buildTools(agent: AgentDef, agents?: Record<string, AgentDef>) {
  const tools: Record<string, unknown>[] = [];

  for (const t of agent.tools ?? []) {
    tools.push({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      },
    });
  }

  for (const name of agent.handoffs ?? []) {
    const target = agents?.[name];
    tools.push({
      type: "function",
      function: {
        name: handoffToolName(name),
        description: target
          ? `Hand off to ${target.name}: ${target.description}`
          : `Hand off to ${name}`,
        parameters: { type: "object", properties: {} },
      },
    });
  }

  return tools;
}

export async function createOpenAICompatibleProvider(
  config: RunConfig,
  options: OpenAICompatibleOptions,
): Promise<ProviderBackend> {
  const mod = await importProvider("openai", "bun add openai");
  const OpenAI = mod.default ?? mod.OpenAI ?? mod;
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    defaultHeaders: options.defaultHeaders,
  });

  let activeAgent = config.agent;
  let toolMap = buildToolMap(activeAgent);
  let tools = buildTools(activeAgent, config.agents);
  const messages: Record<string, unknown>[] = [{ role: "system", content: activeAgent.prompt }];

  function swapAgent(agent: AgentDef) {
    activeAgent = agent;
    toolMap = buildToolMap(activeAgent);
    tools = buildTools(activeAgent, config.agents);
    messages[0] = { role: "system", content: activeAgent.prompt };
  }

  async function* runStream(signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const maxTurns = config.maxTurns ?? 100;

    for (let turn = 0; turn < maxTurns; turn++) {
      const model = activeAgent.model ?? "gpt-4o";

      const stream = await client.chat.completions.create({
        model,
        messages,
        ...(tools.length > 0 ? { tools } : {}),
        stream: true,
        signal,
      });

      let fullText = "";
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
      let finishReason: string | null = null;
      let usage: { inputTokens: number; outputTokens: number } | undefined;

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          fullText += delta.content;
          yield { type: "text", text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: tc.id ?? "", name: tc.function?.name ?? "", arguments: "" });
            }
            const entry = toolCalls.get(idx);
            if (!entry) continue;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.arguments += tc.function.arguments;
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
        }
      }

      // Build assistant message
      const assistantMsg: Record<string, unknown> = { role: "assistant" };
      if (fullText) assistantMsg.content = fullText;
      if (toolCalls.size > 0) {
        assistantMsg.tool_calls = [...toolCalls.values()].map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }
      messages.push(assistantMsg);

      if (finishReason !== "tool_calls" || toolCalls.size === 0) {
        yield { type: "done", text: fullText, usage };
        return;
      }

      // Process tool calls
      for (const tc of toolCalls.values()) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments || "{}");
        } catch {
          yield { type: "error", error: `Failed to parse tool arguments for ${tc.name}` };
        }

        yield { type: "tool_call", toolName: tc.name, toolArgs: args, toolCallId: tc.id };

        const handoffTarget = parseHandoff(tc.name);
        if (handoffTarget) {
          const targetAgent = config.agents?.[handoffTarget];
          if (!targetAgent) {
            yield { type: "error", error: `Unknown handoff target: ${handoffTarget}` };
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Error: unknown agent "${handoffTarget}"`,
            });
            continue;
          }

          yield { type: "handoff", fromAgent: activeAgent.name, toAgent: handoffTarget };
          swapAgent(targetAgent);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: `Handed off to ${handoffTarget}`,
          });
          continue;
        }

        const tool = toolMap.get(tc.name);
        if (!tool) {
          const errorResult = `Error: unknown tool "${tc.name}"`;
          yield { type: "tool_result", toolCallId: tc.id, result: errorResult };
          messages.push({ role: "tool", tool_call_id: tc.id, content: errorResult });
          continue;
        }

        try {
          const result = await tool.handler(args);
          yield { type: "tool_result", toolCallId: tc.id, result };
          messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        } catch (err) {
          const errorResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
          yield { type: "tool_result", toolCallId: tc.id, result: errorResult };
          messages.push({ role: "tool", tool_call_id: tc.id, content: errorResult });
        }
      }
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

export async function createOpenAIProvider(config: RunConfig): Promise<ProviderBackend> {
  const opts = (config.providerOptions ?? {}) as Record<string, unknown>;
  return createOpenAICompatibleProvider(config, {
    apiKey: (opts.apiKey as string) ?? process.env.OPENAI_API_KEY ?? "",
    providerOptions: opts,
  });
}
