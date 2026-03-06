import type { RunConfig, StreamChunk, ToolDef } from "../types.js";
import { handoffToolName, parseHandoff } from "../utils/handoff.js";
import { importProvider } from "../utils/import-provider.js";
import type { ProviderBackend } from "./types.js";

export async function createCopilotProvider(config: RunConfig): Promise<ProviderBackend> {
  const { CopilotClient, defineTool, approveAll } = await importProvider(
    "@github/copilot-sdk",
    "bun add @github/copilot-sdk",
  );

  const agentTools = config.agent.tools ?? [];

  // Map ToolDef[] to copilot-sdk tools via defineTool (both use Zod)
  const tools = agentTools.map((t: ToolDef) =>
    defineTool({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      handler: t.handler,
    }),
  );

  // Add synthetic handoff tools (same pattern as kimi provider)
  let currentAgent = config.agent;

  for (const targetName of config.agent.handoffs ?? []) {
    const targetAgent = config.agents?.[targetName];
    tools.push(
      defineTool({
        name: handoffToolName(targetName),
        description: targetAgent?.description ?? `Transfer to ${targetName}`,
        parameters: {} as any,
        handler: async () => `Transferred to ${targetName}`,
      }),
    );
  }

  // Create client
  const clientOptions: Record<string, unknown> = {};
  if (config.providerOptions?.cliPath) clientOptions.cliPath = config.providerOptions.cliPath;
  if (config.providerOptions?.cliUrl) clientOptions.cliUrl = config.providerOptions.cliUrl;
  if (config.providerOptions?.githubToken)
    clientOptions.githubToken = config.providerOptions.githubToken;
  if (config.providerOptions?.clientOptions) {
    Object.assign(clientOptions, config.providerOptions.clientOptions);
  }

  const client = new CopilotClient(clientOptions);
  await client.start();

  // Create session
  const sessionConfig: Record<string, unknown> = {
    streaming: true,
    tools,
    onPermissionRequest: approveAll,
  };
  if (config.agent.model) sessionConfig.model = config.agent.model;
  if (config.providerOptions?.reasoningEffort) {
    sessionConfig.reasoningEffort = config.providerOptions.reasoningEffort;
  }
  if (config.agent.prompt) {
    sessionConfig.systemMessage = { content: config.agent.prompt };
  }
  if (config.workDir) sessionConfig.workDir = config.workDir;
  if (config.providerOptions?.sessionOptions) {
    Object.assign(sessionConfig, config.providerOptions.sessionOptions);
  }

  const session = await client.createSession(sessionConfig);

  // Bridge event-based streaming to AsyncGenerator
  async function* runPrompt(prompt: string): AsyncGenerator<StreamChunk> {
    let fullText = "";
    let done = false;

    const queue: StreamChunk[] = [];
    let resolve: (() => void) | null = null;

    function push(chunk: StreamChunk) {
      queue.push(chunk);
      if (resolve) {
        resolve();
        resolve = null;
      }
    }

    const unsubs: (() => void)[] = [];

    unsubs.push(
      session.on("assistant.message_delta", (event: any) => {
        const text = event.data?.deltaContent ?? "";
        if (text) {
          fullText += text;
          push({ type: "text", text });
        }
      }),
    );

    unsubs.push(
      session.on("tool.execution_start", (event: any) => {
        const name = event.data?.toolName ?? "";
        push({
          type: "tool_call",
          toolName: name,
          toolArgs: (event.data?.arguments as Record<string, unknown>) ?? {},
          toolCallId: event.data?.toolCallId ?? "",
        });

        // Check for handoff
        const handoffTarget = parseHandoff(name);
        if (handoffTarget) {
          const targetAgent = config.agents?.[handoffTarget];
          if (targetAgent) {
            push({
              type: "handoff",
              fromAgent: currentAgent.name,
              toAgent: handoffTarget,
            });
            currentAgent = targetAgent;
          }
        }
      }),
    );

    unsubs.push(
      session.on("tool.execution_complete", (event: any) => {
        const result = event.data?.result?.content;
        push({
          type: "tool_result",
          toolCallId: event.data?.toolCallId ?? "",
          result: typeof result === "string" ? result : JSON.stringify(result ?? ""),
        });
      }),
    );

    let usage: { inputTokens: number; outputTokens: number } | undefined;

    unsubs.push(
      session.on("assistant.usage", (event: any) => {
        if (event.data?.inputTokens != null) {
          usage = {
            inputTokens: event.data.inputTokens,
            outputTokens: event.data.outputTokens ?? 0,
          };
        }
      }),
    );

    unsubs.push(
      session.on("session.error", (event: any) => {
        push({ type: "error", error: event.data?.message ?? "Unknown error" });
        push({ type: "done", text: fullText, usage });
        done = true;
      }),
    );

    unsubs.push(
      session.on("session.idle", () => {
        push({ type: "done", text: fullText, usage });
        done = true;
      }),
    );

    if (config.signal) {
      const onAbort = () => session.abort();
      config.signal.addEventListener("abort", onAbort, { once: true });
      unsubs.push(() => config.signal?.removeEventListener("abort", onAbort));
    }

    // Send the prompt
    await session.send({ prompt });

    // Yield chunks as they arrive
    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          const chunk = queue.shift();
          if (chunk) yield chunk;
        } else if (!done) {
          await new Promise<void>((r) => {
            resolve = r;
          });
        }
      }
    } finally {
      for (const unsub of unsubs) unsub();
    }
  }

  return {
    run: runPrompt,
    chat: runPrompt,
    async close() {
      try {
        await session.destroy();
      } finally {
        await client.stop();
      }
    },
  };
}
