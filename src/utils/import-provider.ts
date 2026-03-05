/** Dynamically import an optional peer dependency with a clear install hint on failure */
export async function importProvider<T = any>(pkg: string, installHint: string): Promise<T> {
  try {
    return await import(pkg);
  } catch {
    throw new Error(`${pkg} is required. Install it with: ${installHint}`);
  }
}
