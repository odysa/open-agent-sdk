# Specs

Internal developer contracts for the Open Agent SDK. Each spec defines the invariants, behaviors, and edge cases a subsystem must uphold.

**If a spec and implementation diverge, update the implementation.**

## How to read specs

- Language follows [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119): MUST, SHOULD, MAY have precise meanings
- Each spec covers one contract boundary
- Sections: **Interface/Types**, **Behavior**, **Invariants**, **Error handling**, **Edge cases**
- Specs are 60-120 lines, scannable, no tutorials

## Index

| Spec | Contract | Primary source |
|------|----------|---------------|
| [sdk.md](sdk.md) | `query()`, `tool()`, `createSdkMcpServer()`, drop-in claude-agent-sdk replacement | `src/sdk/` |
| [streaming.md](streaming.md) | StreamChunk discriminated union, ordering, field contracts | `src/types.ts` |
| [runner.md](runner.md) | *(deprecated)* `run()`, `runToCompletion()`, provider resolution | `src/runner.ts` |
| [provider.md](provider.md) | ProviderBackend interface, built-in providers, peer deps | `src/providers/types.ts`, `src/providers/*.ts` |
| [middleware.md](middleware.md) | Middleware type, composition, built-in middleware | `src/middleware/` |
| [tools.md](tools.md) | ToolDef interface, schema conversion, handler contract | `src/types.ts`, `src/tool.ts` |
| [agents-and-handoffs.md](agents-and-handoffs.md) | AgentDef interface, handoff mechanism | `src/types.ts`, `src/agent.ts` |
| [sessions.md](sessions.md) | Session interface, SessionStore, history | `src/session.ts` |
| [registry.md](registry.md) | `registerProvider`/`clearProviders`, resolution priority | `src/registry.ts` |
| [structured-output.md](structured-output.md) | `runToCompletion` + `responseSchema`, JSON extraction | `src/runner.ts`, `src/utils/extract-json.ts` |

## Conventions

- Update the relevant spec **before** implementing a change
- New subsystems MUST have a spec added here before merging
- Specs do not replace inline JSDoc; they define cross-cutting contracts that JSDoc cannot capture
