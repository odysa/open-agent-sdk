import type {
  AnyZodRawShape,
  CallToolResult,
  InferShape,
  SdkMcpToolDefinition,
  ToolAnnotations,
} from "./types.js";

/** Define an MCP tool with a Zod schema and handler. */
export function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations },
): SdkMcpToolDefinition<Schema> {
  return { name, description, inputSchema, handler, annotations: extras?.annotations };
}
