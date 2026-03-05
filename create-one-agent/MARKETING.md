# Marketing Drafts

## Tweet (English)

One Agent SDK — write your AI agent once, run it on Claude Code, Codex, or Kimi.

- Streaming-first (AsyncGenerator)
- Type-safe tools with Zod
- Multi-agent handoffs
- Composable middleware

Get started in 30 seconds:
npx create-one-agent my-app

https://github.com/odysa/one-agent-sdk

---

## Tweet (Chinese)

One Agent SDK — 一套代码适配所有 LLM Agent 后端。

写一次 agent，换一行 provider 就能跑 Claude Code / Codex / Kimi：
- Streaming-first，统一 AsyncGenerator 接口
- Zod 定义工具，类型安全
- 多 Agent 协作 handoff
- 可组合的中间件系统

30 秒上手：
npx create-one-agent my-app

https://github.com/odysa/one-agent-sdk

---

## Show HN

### Title

Show HN: One Agent SDK – Write your AI agent once, run on Claude Code, Codex, or Kimi

### Body

Hi HN,

I built One Agent SDK because I got tired of rewriting the same agent logic every time I switched LLM providers. Each SDK has its own streaming format, tool-calling API, and agent patterns — so your code is locked in from day one.

One Agent SDK gives you a single TypeScript interface. Write your agents, tools, and orchestration once, then swap backends by changing one string:

```typescript
const { stream } = await run("Analyze this code", {
  provider: "claude-code",  // or "codex" or "kimi-cli"
  agent,
});
```

Key design decisions:

**Streaming-first.** Every provider returns `AsyncGenerator<StreamChunk>` — a unified discriminated union of text, tool_call, tool_result, handoff, error, and done events. No callbacks, no event emitters — just a for-await loop.

**Type-safe tools with Zod.** Define tool parameters with Zod schemas. The SDK converts them to whatever format each provider needs (MCP server for Claude, JSON Schema for Codex, createExternalTool for Kimi).

**Multi-agent handoffs.** Agents declare who they can hand off to. The SDK handles routing — Claude's built-in agent support, synthetic transfer_to_X tools for Codex/Kimi — all transparent to your code.

**Composable middleware.** AsyncGenerator transforms that sit between the provider and your app. Ships with logging, usage tracking, timing, guardrails, and hooks. Write your own in ~5 lines.

**Zero lock-in.** Provider SDKs are optional peer deps, dynamically imported at runtime. Install only what you need.

Try it:

```
npx create-one-agent my-app
cd my-app && npm install && npm start
```

GitHub: https://github.com/odysa/one-agent-sdk

Would love feedback on the API design, especially from anyone who's been wrangling multiple agent SDKs. What's missing? What would make you actually switch?
