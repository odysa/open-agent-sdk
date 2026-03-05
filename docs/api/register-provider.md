# registerProvider()

Registers a custom provider backend.

## Signature

```typescript
function registerProvider(name: string, factory: ProviderFactory): void
```

Where `ProviderFactory` is:

```typescript
type ProviderFactory = (config: RunConfig) => Promise<ProviderBackend>;
```

## Parameters

### `name`

- **Type:** `string`
- A unique name for the provider. Used as the `provider` value in `RunConfig`.

### `factory`

- **Type:** `ProviderFactory`
- An async function that receives the `RunConfig` and returns a `ProviderBackend`.

## ProviderBackend Interface

```typescript
interface ProviderBackend {
  run(prompt: string, config: RunConfig): AsyncGenerator<StreamChunk>;
  chat(message: string): AsyncGenerator<StreamChunk>;
  close(): Promise<void>;
}
```

## Example

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

// Now use it like any built-in provider
const { stream } = await run("Hello", {
  provider: "my-llm",
  agent,
});
```

## clearProviders()

Removes all registered custom providers. Useful for testing.

```typescript
import { clearProviders } from "one-agent-sdk";

clearProviders();
```

## See Also

- [Providers guide](/guide/providers) — custom providers section
