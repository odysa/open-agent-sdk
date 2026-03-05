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
  provider: "claude-code",
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
  provider: "kimi-cli",
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
  provider: "claude-code",
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
const provider = "claude-code"; // or "codex" or "kimi-cli"

const { stream } = await run("Hello", { provider, agent });
```

Your tools, agents, and stream processing code stay exactly the same.

## Custom Providers

You can register your own provider backends using `registerProvider()`:

```typescript
import { registerProvider, run } from "one-agent-sdk";

registerProvider("my-llm", async (config) => {
  return {
    async *run(prompt) {
      yield { type: "text", text: `Echo: ${prompt}` };
      yield { type: "done", text: `Echo: ${prompt}` };
    },
    async *chat(message) {
      yield { type: "text", text: `Echo: ${message}` };
      yield { type: "done", text: `Echo: ${message}` };
    },
    async close() {},
  };
});

// Use like any built-in provider
const { stream } = await run("Hello", {
  provider: "my-llm",
  agent,
});
```

Custom providers are checked before built-in ones, so you can even override a built-in provider name if needed. See the [registerProvider() API reference](/api/register-provider) for details.
