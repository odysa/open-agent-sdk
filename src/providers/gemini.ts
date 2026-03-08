import type { RunConfig, StreamChunk } from "../types.js";
import { handoffToolName, parseHandoff } from "../utils/handoff.js";
import { importProvider } from "../utils/import-provider.js";
import type { ProviderBackend } from "./types.js";

export async function createGeminiProvider(config: RunConfig): Promise<ProviderBackend> {
  const gemini = await importProvider("@google/gemini-cli-core", "bun add @google/gemini-cli-core");

  const {
    Config,
    GeminiChat,
    Turn,
    GeminiEventType,
    ApprovalMode,
    DEFAULT_GEMINI_MODEL,
    convertToFunctionResponse,
  } = gemini;

  const workDir = config.workDir ?? process.cwd();

  // Merge MCP servers from agent and config
  const mcpServers: Record<string, any> = {};
  for (const [name, srv] of Object.entries(config.agent.mcpServers ?? {})) {
    mcpServers[name] = { command: srv.command, args: srv.args, env: srv.env };
  }
  for (const [name, srv] of Object.entries(config.mcpServers ?? {})) {
    mcpServers[name] = { command: srv.command, args: srv.args, env: srv.env };
  }

  const geminiConfig = new Config({
    sessionId: crypto.randomUUID(),
    targetDir: workDir,
    cwd: workDir,
    model: config.agent.model ?? DEFAULT_GEMINI_MODEL,
    debugMode: false,
    approvalMode: ApprovalMode.YOLO,
    mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
  });

  await geminiConfig.initialize();

  // Build tool declarations for the Gemini API
  const agentTools = config.agent.tools ?? [];
  const toolHandlers = new Map<string, (params: any) => Promise<string>>();
  const toolDeclarations: any[] = [];

  for (const t of agentTools) {
    toolHandlers.set(t.name, t.handler);
    toolDeclarations.push({
      name: t.name,
      description: t.description,
      parameters: zodToGeminiSchema(t.parameters),
    });
  }

  // Add synthetic handoff tools
  let currentAgent = config.agent;

  for (const targetName of config.agent.handoffs ?? []) {
    const targetAgent = config.agents?.[targetName];
    const name = handoffToolName(targetName);
    toolHandlers.set(name, async () => `Transferred to ${targetName}`);
    toolDeclarations.push({
      name,
      description: targetAgent?.description ?? `Transfer to ${targetName}`,
      parameters: { type: "OBJECT", properties: {} },
    });
  }

  const chat = new GeminiChat(geminiConfig, config.agent.prompt ?? "", toolDeclarations, []);

  let turnCounter = 0;

  async function* runPrompt(prompt: string): AsyncGenerator<StreamChunk> {
    let fullText = "";
    let message: any = prompt;
    const maxTurns = config.maxTurns ?? 50;

    for (let turnIdx = 0; turnIdx < maxTurns; turnIdx++) {
      const promptId = `sdk-${turnCounter++}`;
      const turn = new Turn(chat, promptId);

      const pendingToolCalls: Array<{
        callId: string;
        name: string;
        args: Record<string, unknown>;
      }> = [];
      let usageData: { inputTokens: number; outputTokens: number } | undefined;

      for await (const event of turn.run("main", message, config.signal)) {
        switch (event.type) {
          case GeminiEventType.Content: {
            const text = event.value;
            if (text) {
              fullText += text;
              yield { type: "text", text };
            }
            break;
          }

          case GeminiEventType.ToolCallRequest: {
            const req = event.value;
            yield {
              type: "tool_call",
              toolName: req.name,
              toolArgs: req.args ?? {},
              toolCallId: req.callId,
            };

            // Check for handoff
            const handoffTarget = parseHandoff(req.name);
            if (handoffTarget) {
              const targetAgent = config.agents?.[handoffTarget];
              if (targetAgent) {
                yield {
                  type: "handoff",
                  fromAgent: currentAgent.name,
                  toAgent: handoffTarget,
                };
                currentAgent = targetAgent;
              }
            }

            pendingToolCalls.push({
              callId: req.callId,
              name: req.name,
              args: req.args ?? {},
            });
            break;
          }

          case GeminiEventType.Finished: {
            const meta = event.value?.usageMetadata;
            if (meta) {
              usageData = {
                inputTokens: meta.promptTokenCount ?? 0,
                outputTokens: meta.candidatesTokenCount ?? 0,
              };
            }
            break;
          }

          case GeminiEventType.Error: {
            const errMsg = event.value?.error?.message ?? "Unknown Gemini error";
            yield { type: "error", error: errMsg };
            yield { type: "done", text: fullText };
            return;
          }

          // Skip: Thought, Citation, Retry, etc.
        }
      }

      // If no tool calls, we're done
      if (pendingToolCalls.length === 0) {
        yield { type: "done", text: fullText, usage: usageData };
        return;
      }

      // Execute tool calls and build function response parts
      const responseParts: any[] = [];

      for (const tc of pendingToolCalls) {
        const handler = toolHandlers.get(tc.name);
        let result: string;

        if (handler) {
          try {
            result = await handler(tc.args);
          } catch (err: any) {
            result = `Error: ${err?.message ?? String(err)}`;
          }
        } else {
          result = `Error: Unknown tool "${tc.name}"`;
        }

        yield {
          type: "tool_result",
          toolCallId: tc.callId,
          result,
        };

        const parts = convertToFunctionResponse(
          tc.name,
          tc.callId,
          result,
          geminiConfig.getActiveModel?.() ?? geminiConfig.model,
        );
        responseParts.push(...parts);
      }

      // Send tool results back for the next turn
      message = responseParts;
    }

    // Exceeded max turns
    yield { type: "done", text: fullText };
  }

  return {
    run: runPrompt,
    chat: runPrompt,
    async close() {
      geminiConfig.dispose?.();
    },
  };
}

/** Convert a Zod schema to Gemini-compatible JSON Schema (simplified) */
function zodToGeminiSchema(schema: any): any {
  // Use Zod v4's toJsonSchema if available, otherwise try .jsonSchema
  try {
    // Zod v4
    const { toJsonSchema } = require("zod/v4/json-schema");
    const jsonSchema = toJsonSchema(schema);
    return cleanJsonSchema(jsonSchema);
  } catch {
    // Fallback: try zodToJsonSchema from zod
    try {
      const jsonSchema = schema.toJsonSchema?.() ?? schema._def;
      return cleanJsonSchema(jsonSchema);
    } catch {
      return { type: "OBJECT", properties: {} };
    }
  }
}

/** Clean JSON Schema for Gemini API compatibility */
function cleanJsonSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  const result: any = {};
  for (const [key, value] of Object.entries(schema)) {
    // Skip unsupported keys
    if (
      key === "$schema" ||
      key === "definitions" ||
      key === "$defs" ||
      key === "additionalProperties"
    )
      continue;

    // Map 'type' to uppercase for Gemini
    if (key === "type" && typeof value === "string") {
      result[key] = value.toUpperCase();
    } else if (key === "properties" && typeof value === "object" && value !== null) {
      result[key] = {};
      for (const [propKey, propValue] of Object.entries(value as Record<string, any>)) {
        result[key][propKey] = cleanJsonSchema(propValue);
      }
    } else if (key === "items" && typeof value === "object") {
      result[key] = cleanJsonSchema(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
