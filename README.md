# fluidsite-engine

The engine behind [Fluidsite](https://fluidsite.ai): small-business websites managed
entirely by an AI agent. The engine holds all logic, validation and guardrails; client
content lives in separate per-client site repos that the engine operates on.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and principles.

## Install

```bash
npm install
cp .env.example .env   # fill in credentials
```

## Usage

All commands take `--site <path-or-git-url>` and print JSON to stdout.

```bash
npm run fluidsite -- <command> --site <path>
```

Commands: `build`, `get-record`, `propose-change`, `apply-change`, `discard-change`,
`add-image`, `get-analytics`, `extract-prices`, `import`.

## Layout

- `schema/` — Zod schema for the business record (+ JSON Schema export).
- `renderer/` — builds static HTML from a site's `business.json` and its own `theme/`.
- `tools/` — CLI subcommands, exposed via the single `fluidsite` bin.
- `lib/` — shared helpers (git, validation, image optimisation, Cloudflare, screenshots).

## Develop

```bash
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
```
