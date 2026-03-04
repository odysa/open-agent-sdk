export async function createClaudeProvider(config) {
    let claudeSdk;
    try {
        claudeSdk = await import("@anthropic-ai/claude-agent-sdk");
    }
    catch {
        throw new Error('Claude provider requires @anthropic-ai/claude-agent-sdk. Install it with: bun add @anthropic-ai/claude-agent-sdk');
    }
    const { query, createSdkMcpServer, tool } = claudeSdk;
    // Build in-process MCP server for user-defined tools
    const agentTools = config.agent.tools ?? [];
    let mcpServer;
    let toolNames = [];
    if (agentTools.length > 0) {
        const serverName = config.agent.name;
        mcpServer = createSdkMcpServer({
            name: serverName,
            version: "1.0.0",
            tools: agentTools.map((t) => tool(t.name, t.description, t.parameters, async (args) => {
                const result = await t.handler(args);
                return { content: [{ type: "text", text: result }] };
            })),
        });
        toolNames = agentTools.map((t) => `mcp__${serverName}__${t.name}`);
    }
    // Merge MCP servers: user-tool server + agent-level + run-level
    const mcpServers = {};
    if (mcpServer)
        mcpServers[config.agent.name] = mcpServer;
    if (config.agent.mcpServers)
        Object.assign(mcpServers, config.agent.mcpServers);
    if (config.mcpServers)
        Object.assign(mcpServers, config.mcpServers);
    // Build agent definitions for handoffs
    let agents;
    if (config.agent.handoffs?.length && config.agents) {
        agents = config.agent.handoffs
            .map((name) => config.agents[name])
            .filter(Boolean)
            .map((a) => ({
            name: a.name,
            description: a.description,
            instructions: a.prompt,
            tools: a.tools?.map((t) => t.name) ?? [],
        }));
    }
    let sessionId;
    async function* runQuery(prompt) {
        const options = {
            systemPrompt: config.agent.prompt,
            permissionMode: "bypassPermissions",
        };
        if (config.agent.model)
            options.model = config.agent.model;
        if (Object.keys(mcpServers).length > 0)
            options.mcpServers = mcpServers;
        if (toolNames.length > 0)
            options.allowedTools = toolNames;
        if (agents)
            options.agents = agents;
        if (sessionId)
            options.resume = sessionId;
        if (config.maxTurns)
            options.maxTurns = config.maxTurns;
        if (config.providerOptions)
            Object.assign(options, config.providerOptions);
        let fullText = "";
        for await (const msg of query({
            prompt,
            options: options,
            signal: config.signal,
        })) {
            if (msg.type === "system" && msg.subtype === "init") {
                sessionId = msg.session_id;
            }
            if (msg.type === "assistant" && msg.message?.content) {
                for (const block of msg.message.content) {
                    if ("text" in block && block.text) {
                        fullText += block.text;
                        yield { type: "text", text: block.text };
                    }
                    if ("type" in block && block.type === "tool_use") {
                        yield {
                            type: "tool_call",
                            toolName: block.name,
                            toolArgs: block.input ?? {},
                            toolCallId: block.id,
                        };
                    }
                }
            }
            if (msg.type === "result") {
                yield {
                    type: "tool_result",
                    toolCallId: msg.tool_use_id ?? "",
                    result: typeof msg.content === "string"
                        ? msg.content
                        : JSON.stringify(msg.content),
                };
            }
        }
        yield { type: "done", text: fullText };
    }
    return {
        run: runQuery,
        chat: runQuery,
        async close() { },
    };
}
