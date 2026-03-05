const FENCE_RE = /```(?:json)?\s*\n([\s\S]*?)\n```/;

/**
 * Extracts a JSON string from text that may contain markdown code fences.
 * Handles:
 * - Raw JSON strings
 * - JSON wrapped in ```json ... ``` fences (even with surrounding text)
 * - JSON wrapped in ``` ... ``` fences
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();

  const fenceMatch = trimmed.match(FENCE_RE);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  return trimmed;
}
