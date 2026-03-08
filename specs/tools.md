# Tools Spec

Defines the `ToolDef` interface, schema conversion, and handler contract.

> The legacy `defineTool()` is deprecated. Use `tool()` from `one-agent-sdk` instead (see [compat.md](compat.md)).

**Source:** `src/types.ts`, `src/tool.ts`, `src/utils/zod-to-jsonschema.ts`, `src/compat/tool.ts`

## Interface

```ts
interface ToolDef<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: T;
  handler: (params: z.infer<T>) => Promise<string>;
}

function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  parameters: T;
  handler: (params: z.infer<T>) => Promise<string>;
}): ToolDef<T>;

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown>;
```

## Behavior

### `ToolDef`

A tool definition binds a name, description, Zod parameter schema, and async handler.

- `name` — unique identifier within an agent's tool set. Providers use this to register the tool with the LLM.
- `description` — human-readable description passed to the LLM for tool selection.
- `parameters` — a Zod schema. Providers validate incoming tool arguments against this schema before calling the handler.
- `handler` — receives validated parameters, returns a string result. The result is sent back to the LLM as a tool response.

### `defineTool(config)`

Convenience function that returns `config` as-is. Provides type inference so that `handler` parameter types are inferred from `parameters`.

### `zodToJsonSchema(schema)`

Converts a Zod schema to JSON Schema using Zod v4's built-in `z.toJSONSchema()`. Used by providers that require JSON Schema (e.g., OpenAI function calling).

## Invariants

1. Tool `name` MUST be unique within a single agent's `tools` array.
2. `handler` MUST return a `string`. Non-string results break the tool_result contract.
3. `handler` MUST be async (return a `Promise<string>`).
4. `parameters` MUST be a valid Zod schema. Providers rely on `.parse()` or `.safeParse()` for validation.
5. `zodToJsonSchema` MUST produce a valid JSON Schema object compatible with the provider's API.

## Error handling

- If `handler` throws, the provider MUST catch the error and return the error message as the `tool_result` string, allowing the LLM to recover.
- If parameter validation fails (Zod parse error), the provider SHOULD return a validation error as the `tool_result` rather than crashing.

## Edge cases

- A tool with `z.object({})` as parameters (no parameters) is valid. The handler receives `{}`.
- Tool names MAY contain any characters, but providers MAY impose restrictions (e.g., alphanumeric + underscores). Authors SHOULD use `snake_case` names for maximum compatibility.
- `zodToJsonSchema` delegates entirely to Zod v4's `z.toJSONSchema()`. Complex Zod types (unions, intersections, transforms) produce whatever Zod generates — no additional normalization is applied.
