# Contributing to One Agent SDK

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/odysa/one-agent-sdk.git
cd one-agent-sdk
bun install
```

## Development

```bash
bun run dev        # Watch mode build
bun run check      # Type check without emitting
bun run lint       # Lint with Biome
bun run lint:fix   # Lint and auto-fix
bun run format     # Format with Biome
bun run ci         # Type check + lint + test (CI pipeline)
```

Run examples with:

```bash
bun run examples/hello.ts
```

## Project Structure

```
src/
  providers/     # Provider implementations (claude, codex, kimi)
  middleware/    # Built-in middleware
  types.ts       # Core type definitions
  index.ts       # Public API exports
examples/        # Runnable demo scripts
```

## Code Style

- ESM-only with `.js` extensions in imports
- Zod v4 for schemas
- Biome for linting and formatting (2-space indent, 100 char line width)
- No `any` — use `unknown` or proper types

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `docs:` — documentation only
- `test:` — adding or updating tests
- `chore:` — maintenance (deps, CI, build, etc.)

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `bun run ci` to verify everything passes
4. Open a PR with a clear title and description

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
