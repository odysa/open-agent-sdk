import { zodToJsonSchema } from "../utils/zod-to-jsonschema.js";
export async function createOpenAIProvider(config) {
    let OpenAI;
    try {
        const mod = await import("openai");
        OpenAI = mod.default;
    }
    catch {
        throw new Error('OpenAI provider requires the openai package. Install it with: bun add openai');
    }
    const apiKey = config.providerOptions?.apiKey ?? undefined;
    const client = new OpenAI({ apiKey });
    let currentAgent = config.agent;
    const maxTurns = config.maxTurns ?? 10;
    function buildTools(agent) {
        const tools = [];
        // User-defined tools
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
        // Handoff tools (synthetic transfer functions)
        for (const targetName of agent.handoffs ?? []) {
            const targetAgent = config.agents?.[targetName];
            tools.push({
                type: "function",
                function: {
                    name: `transfer_to_${targetName}`,
                    description: targetAgent?.description ?? `Transfer to ${targetName}`,
                    parameters: { type: "object", properties: {} },
                },
            });
        }
        return tools;
    }
    function findTool(agent, name) {
        return agent.tools?.find((t) => t.name === name);
    }
    const messages = [];
    async function* runLoop(prompt) {
        // Set system message for current agent
        if (messages.length === 0) {
            messages.push({ role: "system", content: currentAgent.prompt });
        }
        messages.push({ role: "user", content: prompt });
        let fullText = "";
        let turns = 0;
        while (turns < maxTurns) {
            turns++;
            const tools = buildTools(currentAgent);
            const stream = await client.chat.completions.create({
                model: currentAgent.model ?? "gpt-4o",
                messages,
                ...(tools.length > 0 ? { tools } : {}),
                stream: true,
            });
            // Accumulate the streamed response
            let assistantContent = "";
            const toolCalls = new Map();
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                if (!delta)
                    continue;
                if (delta.content) {
                    assistantContent += delta.content;
                    fullText += delta.content;
                    yield { type: "text", text: delta.content };
                }
                if (delta.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        const existing = toolCalls.get(tc.index) ?? {
                            id: "",
                            name: "",
                            arguments: "",
                        };
                        if (tc.id)
                            existing.id = tc.id;
                        if (tc.function?.name)
                            existing.name = tc.function.name;
                        if (tc.function?.arguments)
                            existing.arguments += tc.function.arguments;
                        toolCalls.set(tc.index, existing);
                    }
                }
            }
            // No tool calls — we're done
            if (toolCalls.size === 0) {
                messages.push({ role: "assistant", content: assistantContent });
                break;
            }
            // Build assistant message with tool calls
            const assistantMsg = {
                role: "assistant",
                content: assistantContent || null,
                tool_calls: [...toolCalls.values()].map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: { name: tc.name, arguments: tc.arguments },
                })),
            };
            messages.push(assistantMsg);
            // Execute each tool call
            for (const tc of toolCalls.values()) {
                let args = {};
                try {
                    args = JSON.parse(tc.arguments || "{}");
                }
                catch {
                    // leave as empty
                }
                yield {
                    type: "tool_call",
                    toolName: tc.name,
                    toolArgs: args,
                    toolCallId: tc.id,
                };
                // Check if this is a handoff
                if (tc.name.startsWith("transfer_to_")) {
                    const targetName = tc.name.slice("transfer_to_".length);
                    const targetAgent = config.agents?.[targetName];
                    if (targetAgent) {
                        yield {
                            type: "handoff",
                            fromAgent: currentAgent.name,
                            toAgent: targetName,
                        };
                        // Provide tool result for the transfer call
                        messages.push({
                            role: "tool",
                            tool_call_id: tc.id,
                            content: `Transferred to ${targetName}`,
                        });
                        // Swap agent: update system prompt and current agent
                        currentAgent = targetAgent;
                        messages[0] = { role: "system", content: currentAgent.prompt };
                        yield {
                            type: "tool_result",
                            toolCallId: tc.id,
                            result: `Transferred to ${targetName}`,
                        };
                        continue;
                    }
                }
                // Execute user-defined tool
                const toolDef = findTool(currentAgent, tc.name);
                let result;
                if (toolDef) {
                    try {
                        result = await toolDef.handler(args);
                    }
                    catch (err) {
                        result = `Error: ${err.message ?? err}`;
                        yield { type: "error", error: result };
                    }
                }
                else {
                    result = `Unknown tool: ${tc.name}`;
                    yield { type: "error", error: result };
                }
                messages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: result,
                });
                yield { type: "tool_result", toolCallId: tc.id, result };
            }
        }
        yield { type: "done", text: fullText };
    }
    return {
        run: runLoop,
        chat: runLoop,
        async close() { },
    };
}
