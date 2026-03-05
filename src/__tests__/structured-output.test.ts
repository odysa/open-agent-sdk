import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { extractJson } from "../utils/extract-json.js";

describe("extractJson", () => {
  test("returns raw JSON as-is", () => {
    const raw = '{"name":"Alice","age":30}';
    expect(extractJson(raw)).toBe(raw);
  });

  test("extracts JSON from plain ``` code fences", () => {
    const fenced = '```\n{"name":"Alice"}\n```';
    expect(extractJson(fenced)).toBe('{"name":"Alice"}');
  });

  test("extracts JSON from ```json code fences", () => {
    const fenced = '```json\n{"name":"Alice","age":30}\n```';
    expect(extractJson(fenced)).toBe('{"name":"Alice","age":30}');
  });

  test("extracts JSON from fences with surrounding text", () => {
    const withText = 'Here is the result:\n```json\n{"name":"Alice"}\n```\nHope that helps!';
    expect(extractJson(withText)).toBe('{"name":"Alice"}');
  });

  test("trims surrounding whitespace", () => {
    const raw = '  {"x":1}  ';
    expect(extractJson(raw)).toBe('{"x":1}');
  });
});

describe("structured output validation", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  test("validates correct data successfully", () => {
    const data = { name: "Alice", age: 30 };
    const result = schema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alice");
      expect(result.data.age).toBe(30);
    }
  });

  test("fails validation with clear issues for invalid data", () => {
    const data = { name: "Alice", age: "not-a-number" };
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].path).toContain("age");
    }
  });

  test("parse logic handles JSON extracted from fences", () => {
    const jsonText = extractJson('```json\n{"name":"Bob","age":25}\n```');
    const parsed = JSON.parse(jsonText);
    const result = schema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bob");
      expect(result.data.age).toBe(25);
    }
  });

  test("parse logic fails on malformed JSON", () => {
    const jsonText = extractJson("not valid json");
    expect(() => JSON.parse(jsonText)).toThrow();
  });

  // Compile-time type inference check
  test("type inference: inferred type matches schema", () => {
    type Inferred = z.infer<typeof schema>;
    const value: Inferred = { name: "Carol", age: 22 };
    expect(value.name).toBe("Carol");
  });
});
