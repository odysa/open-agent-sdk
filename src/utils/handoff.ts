const HANDOFF_PREFIX = "transfer_to_";

export function handoffToolName(agentName: string): string {
  return `${HANDOFF_PREFIX}${agentName}`;
}

export function parseHandoff(toolName: string): string | null {
  return toolName.startsWith(HANDOFF_PREFIX) ? toolName.slice(HANDOFF_PREFIX.length) : null;
}
