import type { AgentDef, ToolDef } from "../types.js";

export function buildToolMap(agent: AgentDef): Map<string, ToolDef> {
  const map = new Map<string, ToolDef>();
  for (const t of agent.tools ?? []) {
    map.set(t.name, t);
  }
  return map;
}
