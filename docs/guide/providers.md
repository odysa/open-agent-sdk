# Providers

One Agent SDK supports multiple LLM backends. Each provider is an optional peer dependency — install only the ones you need.

## Available Providers

### Claude

Uses `@anthropic-ai/claude-agent-sdk`. Spawns Claude Code as a subprocess.

```bash
npm install @anthropic-ai/claude-agent-sdk
```

```typescript
const { stream } = await run("Hello", {
  provider: "claude",
  agent,
});
```

- Tools are exposed via an in-process MCP server
- Handoffs use the SDK's built-in agent support
- Tool names follow `mcp__{serverName}__{toolName}` convention internally

### Codex

Uses `@openai/codex-sdk`. Spawns ChatGPT Codex as a subprocess.

```bash
npm install @openai/codex-sdk
```

```typescript
const { stream } = await run("Hello", {
  provider: "codex",
  agent,
});
```

- Zod schemas are converted to JSON Schema via `zodToJsonSchema()`
- Tool calls use streaming delta accumulation
- Handoffs are synthetic `transfer_to_{name}` function tools

### Kimi

Uses `@moonshot-ai/kimi-agent-sdk`. Spawns Kimi-CLI as a subprocess.

```bash
npm install @moonshot-ai/kimi-agent-sdk
```

```typescript
const { stream } = await run("Hello", {
  provider: "kimi",
  agent,
});
```

- Uses `createSession`/`createExternalTool`
- `ApprovalRequest` events are auto-approved
- Handoffs are synthetic `transfer_to_{name}` function tools

## Provider Options

Pass provider-specific options via `providerOptions`:

```typescript
const { stream } = await run("Hello", {
  provider: "claude",
  agent,
  providerOptions: {
    // Provider-specific configuration
  },
});
```

## Switching Providers

Changing the provider is a one-line change:

```typescript
// Just change this string
const provider = "claude"; // or "codex" or "kimi"

const { stream } = await run("Hello", { provider, agent });
```

Your tools, agents, and stream processing code stay exactly the same.
