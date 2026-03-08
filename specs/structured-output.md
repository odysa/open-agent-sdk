# Structured Output Spec

Defines `runToCompletion` with `responseSchema` and the `extractJson` utility.

**Source:** `src/runner.ts`, `src/utils/extract-json.ts`

## Interface

```ts
function runToCompletion(prompt: string, config: RunConfig): Promise<string>;
function runToCompletion<T extends z.ZodType>(
  prompt: string,
  config: RunConfig & { responseSchema: T },
): Promise<z.infer<T>>;

function extractJson(text: string): string;
```

## Behavior

### `runToCompletion` (structured mode)

When `config.responseSchema` is set:

1. Consume the stream, concatenating all `text` chunks into `text`.
2. Call `close()`.
3. Call `extractJson(text)` to strip markdown fences.
4. Parse the result with `JSON.parse()`.
5. Validate with `responseSchema.safeParse(parsed)`.
6. If valid, return `result.data`.
7. If parse or validation fails, throw.

### `extractJson(text)`

Extracts a JSON string from text that may be wrapped in markdown code fences.

1. Trim whitespace.
2. Match `` ```json\n...\n``` `` or `` ```\n...\n``` `` via regex.
3. If a fence is found, return the inner content (trimmed).
4. Otherwise return the trimmed text as-is.

The regex: `` /```(?:json)?\s*\n([\s\S]*?)\n```/ ``

## Invariants

1. When `responseSchema` is absent, `runToCompletion` MUST return `string`.
2. When `responseSchema` is present, `runToCompletion` MUST return `z.infer<T>` — never the raw string.
3. `extractJson` MUST be applied before `JSON.parse` — LLMs frequently wrap JSON in code fences.
4. Validation MUST use `safeParse`, not `parse`, so that validation errors are thrown with structured issue details rather than Zod's default error format.
5. `close()` MUST be called after stream consumption, regardless of success or failure.

## Error handling

- **JSON parse failure:** throws `Error` with message `"Failed to parse response as JSON: {text}"`.
- **Zod validation failure:** throws `Error` with message `"Response validation failed: {issues}"` where issues is pretty-printed JSON.
- Both errors include the problematic text/issues for debugging.

## Edge cases

- LLM returns JSON with surrounding prose (e.g., "Here is the result: ```json {...} ```"): `extractJson` handles this correctly.
- LLM returns raw JSON without fences: `extractJson` returns it as-is, `JSON.parse` succeeds.
- LLM returns a code fence with language tag other than `json` (e.g., `` ```javascript ``): the regex does not match; the full text (with fences) is passed to `JSON.parse`, which will likely fail.
- Nested code fences: the non-greedy `[\s\S]*?` matches the first closing fence.
- Empty response: `JSON.parse("")` throws, surfaced as "Failed to parse response as JSON".
