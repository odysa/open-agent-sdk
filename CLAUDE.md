# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install              # Install dependencies
bun run build            # Build (tsc -> dist/)
bun run dev              # Watch mode build
bun run check            # Type check without emitting
bun run lint             # Lint with Biome
bun run lint:fix         # Lint and auto-fix
bun run format           # Format with Biome
bun run ci               # Type check + lint (CI pipeline)
```

Run examples: `bun run examples/basic.ts`

## Architecture

Open Agent SDK is a provider-agnostic TypeScript SDK for building LLM agents with tools and multi-agent handoffs. It exposes a unified streaming interface (`AsyncGenerator<StreamChunk>`) regardless of backend.

### Core Flow

`run(prompt, config)` -> dynamically imports the provider -> returns `{ stream, chat, close }` (`AgentRun`)

### Provider System (`src/providers/`)

Each provider implements the `Provider` interface (`run`, `chat`, `close`) and is dynamically imported based on `RunConfig.provider`:

- **claude** — wraps `@anthropic-ai/claude-agent-sdk`. Exposes user tools via an in-process MCP server (`createSdkMcpServer`). Tool names follow `mcp__{serverName}__{toolName}` convention.
- **openai** — wraps `openai` SDK. Converts Zod schemas to JSON Schema via `zodToJsonSchema()`. Implements tool call loop with streaming delta accumulation. Handoffs are synthetic `transfer_to_{name}` function tools that swap the system prompt.
- **kimi** — wraps `@moonshot-ai/kimi-agent-sdk`. Uses `createSession`/`createExternalTool`. Auto-approves `ApprovalRequest` events.

All three are optional peer dependencies with ambient type declarations in `src/shims.d.ts`.

### Key Types (`src/types.ts`)

- `ToolDef<T>` — tool with Zod schema for parameters and async handler
- `AgentDef` — agent with prompt, tools, handoff targets, optional MCP servers
- `StreamChunk` — discriminated union: `text | tool_call | tool_result | handoff | error | done`
- `RunConfig` — provider selection, agent, additional agents map for handoffs, provider options

### Middleware (`src/middleware/`)

`defineMiddleware` wraps an async generator transform; `applyMiddleware` composes a middleware array over a stream. `core.ts` has the primitives, the remaining files are built-in middleware (`logging`, `usageTracker`, `timing`, `textCollector`, `guardrails`, `hooks`, `filter`). Barrel re-exported from `index.ts`. Stateful middleware (`usageTracker`, `textCollector`) return a handle with `middleware` plus accessor methods.

### Handoff Pattern

Agents declare `handoffs: string[]` referencing agent names. The runner's `agents` map provides the full definitions. OpenAI/Kimi providers implement handoffs as synthetic `transfer_to_{name}` tools that swap the active agent. Claude provider delegates to the SDK's built-in agent support.

## Specs (`specs/`)

This project is spec-driven. Specs define internal developer contracts — the invariants, behaviors, and edge cases each subsystem must uphold. If a spec and implementation diverge, update the implementation.

Before modifying a subsystem, read its spec. When adding new behavior, update the relevant spec first.

See `specs/README.md` for the full index.

## Conventions

- ESM-only (`"type": "module"`), all imports use `.js` extensions
- Zod v4 for tool parameter schemas
- Biome for linting/formatting (2-space indent, 100 char line width, `noExplicitAny: off`)
- `dist/` is checked into git (pre-built output)

## Commit & PR Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/). Prefix commit messages and PR titles with a type:

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `docs:` — documentation only
- `test:` — adding or updating tests
- `chore:` — maintenance (deps, CI, build, etc.)

Examples: `fix: normalize error→done in codex provider`, `refactor: extract shared importProvider helper`
