import type { z } from "zod";

/**
 * Convert a Zod schema to JSON Schema.
 * Uses Zod v4's built-in toJSONSchema() if available,
 * otherwise falls back to a basic conversion.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Zod v4 has built-in toJSONSchema()
  if ("toJSONSchema" in (schema.constructor as any)) {
    const zod = schema.constructor as any;
    return zod.toJSONSchema(schema);
  }

  // Try the zod module-level function
  try {
    const z = getZodModule(schema);
    if (z && typeof z.toJSONSchema === "function") {
      return z.toJSONSchema(schema);
    }
  } catch {
    // Fall through to manual conversion
  }

  return manualConvert(schema);
}

function getZodModule(schema: z.ZodType): any {
  // Access the zod module from the schema's prototype chain
  const proto = Object.getPrototypeOf(schema);
  if (proto?.constructor?._zod_module) {
    return proto.constructor._zod_module;
  }
  return undefined;
}

function manualConvert(schema: z.ZodType): Record<string, unknown> {
  const def = (schema as any)._def ?? (schema as any)._zod;

  if (!def) {
    return { type: "object" };
  }

  const typeName = def.typeName ?? def.type;

  switch (typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return {
        type: "array",
        items: manualConvert(def.type ?? def.innerType),
      };
    case "ZodObject": {
      const shape = def.shape ?? (typeof def.shape === "function" ? def.shape() : {});
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = manualConvert(value as z.ZodType);
        const innerDef = (value as any)._def ?? (value as any)._zod;
        const innerType = innerDef?.typeName ?? innerDef?.type;
        if (innerType !== "ZodOptional") {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }
    case "ZodOptional":
      return manualConvert(def.innerType ?? def.type);
    case "ZodEnum":
      return { type: "string", enum: def.values };
    default:
      return { type: "object" };
  }
}
