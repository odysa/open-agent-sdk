import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createSdkMcpServer, MOCK_MCP_SERVER } from "../sdk/mcp-server.js";
import { toRunConfig } from "../sdk/query.js";
import { tool } from "../sdk/tool.js";

describe("tool()", () => {
  const weatherTool = tool(
    "get_weather",
    "Get weather for a city",
    { city: z.string() },
    async (args) => ({ content: [{ type: "text" as const, text: `Weather in ${args.city}` }] }),
    { annotations: { title: "Weather" } },
  );

  test("returns object with correct name and description", () => {
    expect(weatherTool.name).toBe("get_weather");
    expect(weatherTool.description).toBe("Get weather for a city");
  });

  test("preserves inputSchema", () => {
    expect(weatherTool.inputSchema).toBeDefined();
    expect(weatherTool.inputSchema.city).toBeDefined();
  });

  test("handler returns CallToolResult", async () => {
    const result = await weatherTool.handler({ city: "SF" }, {});
    expect(result.content[0].text).toBe("Weather in SF");
  });

  test("preserves annotations from extras", () => {
    expect(weatherTool.annotations).toEqual({ title: "Weather" });
  });

  test("annotations are undefined when not provided", () => {
    const t = tool("simple", "desc", {}, async () => ({ content: [] }));
    expect(t.annotations).toBeUndefined();
  });
});

describe("createSdkMcpServer()", () => {
  const t = tool("test_tool", "A test", {}, async () => ({ content: [] }));
  const server = createSdkMcpServer({ name: "test-server", tools: [t] });

  test("returns config with type sdk", () => {
    expect(server.type).toBe("sdk");
  });

  test("returns config with correct name", () => {
    expect(server.name).toBe("test-server");
  });

  test("contains MOCK_MCP_SERVER symbol with options", () => {
    expect(MOCK_MCP_SERVER in server).toBe(true);
    const mockConfig = (server as any)[MOCK_MCP_SERVER];
    expect(mockConfig.name).toBe("test-server");
    expect(mockConfig.tools).toHaveLength(1);
    expect(mockConfig.tools[0].name).toBe("test_tool");
  });

  test("works with no tools", () => {
    const empty = createSdkMcpServer({ name: "empty" });
    expect(empty.type).toBe("sdk");
    expect((empty as any)[MOCK_MCP_SERVER].tools).toBeUndefined();
  });
});

describe("toRunConfig()", () => {
  test("maps Options fields to RunConfig", () => {
    const abort = new AbortController();
    const config = toRunConfig("codex", {
      agentName: "my-agent",
      agentDescription: "My agent",
      systemPrompt: "Be helpful",
      model: "gpt-4",
      maxTurns: 5,
      cwd: "/tmp",
      abortController: abort,
      providerOptions: { temperature: 0.5 },
    });

    expect(config.provider).toBe("codex");
    expect(config.agent.name).toBe("my-agent");
    expect(config.agent.description).toBe("My agent");
    expect(config.agent.prompt).toBe("Be helpful");
    expect(config.agent.model).toBe("gpt-4");
    expect(config.maxTurns).toBe(5);
    expect(config.workDir).toBe("/tmp");
    expect(config.signal).toBe(abort.signal);
    expect(config.providerOptions).toEqual({ temperature: 0.5 });
  });

  test("uses defaults for missing fields", () => {
    const config = toRunConfig("codex", {});
    expect(config.agent.name).toBe("default");
    expect(config.agent.description).toBe("Default agent");
    expect(config.agent.prompt).toBe("You are a helpful assistant.");
  });

  test("extracts tools from mock MCP servers", () => {
    const t = tool("my_tool", "desc", { x: z.number() }, async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    const server = createSdkMcpServer({ name: "srv", tools: [t] });

    const config = toRunConfig("codex", {
      mcpServers: { srv: server },
    });

    const tools = config.agent.tools;
    expect(tools).toHaveLength(1);
    expect(tools?.[0].name).toBe("my_tool");
    expect(tools?.[0].description).toBe("desc");
  });

  test("extracted tool handler wraps CallToolResult to string", async () => {
    const t = tool("wrap_test", "desc", {}, async () => ({
      content: [{ type: "text" as const, text: "result" }],
    }));
    const server = createSdkMcpServer({ name: "srv", tools: [t] });
    const config = toRunConfig("codex", { mcpServers: { srv: server } });

    const tools = config.agent.tools;
    expect(tools).toBeDefined();
    const result = await tools?.[0].handler({});
    expect(typeof result).toBe("string");
    expect(JSON.parse(result)).toEqual({
      content: [{ type: "text", text: "result" }],
    });
  });

  test("ignores non-mock MCP server configs", () => {
    const config = toRunConfig("codex", {
      mcpServers: { plain: { type: "stdio", command: "node" } },
    });
    expect(config.agent.tools).toBeUndefined();
  });
});
