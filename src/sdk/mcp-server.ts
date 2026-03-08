import type { CreateSdkMcpServerOptions, McpSdkServerConfigWithInstance } from "./types.js";

/**
 * Symbol to identify mock MCP server configs created by our implementation.
 * Used by query() to materialize real MCP servers when delegating to claude-code.
 */
export const MOCK_MCP_SERVER = Symbol.for("one-agent-sdk-mock-mcp-server");

export type MockMcpServerConfig = McpSdkServerConfigWithInstance & {
  [MOCK_MCP_SERVER]: CreateSdkMcpServerOptions;
};

/**
 * Create an MCP server configuration for use with query().
 *
 * For claude-code: the real MCP server is created lazily when query() delegates
 * to the Anthropic SDK. For other providers: tool definitions are extracted directly.
 */
export function createSdkMcpServer(
  options: CreateSdkMcpServerOptions,
): McpSdkServerConfigWithInstance {
  return {
    type: "sdk",
    name: options.name,
    instance: null as unknown,
    [MOCK_MCP_SERVER]: options,
  } as MockMcpServerConfig;
}
