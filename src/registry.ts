import type { ProviderBackend } from "./providers/types.js";
import type { RunConfig } from "./types.js";

export type ProviderFactory = (config: RunConfig) => Promise<ProviderBackend>;

const registry = new Map<string, ProviderFactory>();

/** Register a custom provider */
export function registerProvider(name: string, factory: ProviderFactory): void {
  registry.set(name, factory);
}

/** Get a registered provider factory (returns undefined if not found) */
export function getProvider(name: string): ProviderFactory | undefined {
  return registry.get(name);
}

/** Clear all registered providers (useful for testing) */
export function clearProviders(): void {
  registry.clear();
}
