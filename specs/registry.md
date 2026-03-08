# Registry Spec

Defines provider registration, lookup, and resolution priority.

**Source:** `src/registry.ts`

## Interface

```ts
type ProviderFactory = (config: RunConfig) => Promise<ProviderBackend>;

function registerProvider(name: string, factory: ProviderFactory): void;
function getProvider(name: string): ProviderFactory | undefined;
function clearProviders(): void;
```

## Behavior

### `registerProvider(name, factory)`

Stores a provider factory in the module-level registry `Map`. If `name` already exists, the previous factory is silently overwritten.

### `getProvider(name)`

Returns the factory for `name`, or `undefined` if not registered.

### `clearProviders()`

Removes all entries from the registry. Intended for testing.

### Resolution priority (in `createProvider`)

1. **Registry first:** `getProvider(config.provider)` is checked before built-in providers.
2. **Built-in second:** if the registry returns `undefined`, match against `claude-code`, `codex`, `kimi-cli`.
3. **Error:** if neither matches, throw.

This means a registered provider with a built-in name (e.g., `"claude-code"`) **overrides** the built-in.

## Invariants

1. The registry MUST be module-scoped (singleton per process).
2. `registerProvider` MUST allow overwriting existing entries.
3. Registry lookups MUST take priority over built-in providers in `createProvider`.
4. `clearProviders` MUST remove all entries, leaving built-in providers accessible.
5. `ProviderFactory` MUST be async — it returns `Promise<ProviderBackend>`.

## Error handling

- `registerProvider` and `getProvider` do not throw.
- `clearProviders` does not throw.
- Errors from a registered factory propagate through `createProvider` to the caller of `run()`.

## Edge cases

- Registering with an empty string `""` as the name is allowed but not useful.
- Calling `clearProviders()` when the registry is already empty is a no-op.
- A factory that returns a non-conforming `ProviderBackend` will cause runtime errors downstream — no validation is performed at registration time.
