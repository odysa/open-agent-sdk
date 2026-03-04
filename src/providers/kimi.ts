import type { Provider } from "./types.js";
import type { StreamChunk, RunConfig, ToolDef, AgentDef } from "../types.js";

export async function createKimiProvider(
  config: RunConfig
): Promise<Provider> {
  let kimiSdk: any;
  try {
    kimiSdk = await import("@moonshot-ai/kimi-agent-sdk");
  } catch {
    throw new Error(
      'Kimi provider requires @moonshot-ai/kimi-agent-sdk. Install it with: bun add @moonshot-ai/kimi-agent-sdk'
    );
  }

  const { createSession, createExternalTool } = kimiSdk;

  const agentTools = config.agent.tools ?? [];

  // Build external tools from agent tool definitions
  const externalTools = agentTools.map((t: ToolDef) =>
    createExternalTool({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      handler: async (params: any) => {
        const result = await t.handler(params);
        return { output: result, message: "ok" };
      },
    })
  );

  // Add synthetic handoff tools
  let currentAgent = config.agent;

  for (const targetName of config.agent.handoffs ?? []) {
    const targetAgent = config.agents?.[targetName];
    externalTools.push(
      createExternalTool({
        name: `transfer_to_${targetName}`,
        description: targetAgent?.description ?? `Transfer to ${targetName}`,
        parameters: {} as any,
        handler: async () => {
          return { output: `Transferred to ${targetName}`, message: "ok" };
        },
      })
    );
  }

  const session = createSession({
    workDir: config.workDir ?? process.cwd(),
    model: config.agent.model ?? "kimi-latest",
    externalTools,
  });

  async function* runPrompt(prompt: string): AsyncGenerator<StreamChunk> {
    const turn = session.prompt(prompt);
    let fullText = "";

    for await (const event of turn) {
      if (event.type === "ContentPart" && event.payload.type === "text") {
        fullText += event.payload.text;
        yield { type: "text", text: event.payload.text };
      }

      if (event.type === "ApprovalRequest") {
        await (turn as any).approve(event.payload.id, "approve");
      }

      if (event.type === "ToolCall") {
        const name = event.payload.name;
        yield {
          type: "tool_call",
          toolName: name,
          toolArgs: event.payload.arguments ?? {},
          toolCallId: event.payload.id ?? "",
        };

        // Check for handoff
        if (name.startsWith("transfer_to_")) {
          const targetName = name.slice("transfer_to_".length);
          const targetAgent = config.agents?.[targetName];
          if (targetAgent) {
            yield {
              type: "handoff",
              fromAgent: currentAgent.name,
              toAgent: targetName,
            };
            currentAgent = targetAgent;
          }
        }
      }

      if (event.type === "ToolResult") {
        yield {
          type: "tool_result",
          toolCallId: event.payload.id ?? "",
          result:
            typeof event.payload.output === "string"
              ? event.payload.output
              : JSON.stringify(event.payload.output),
        };
      }
    }

    yield { type: "done", text: fullText };
  }

  return {
    run: runPrompt,
    chat: runPrompt,
    async close() {
      await session.close();
    },
  };
}
