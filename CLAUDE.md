# fluidsite-engine

## What this is

This repo is the engine behind Fluidsite: small business websites managed entirely
by an AI agent over WhatsApp. It is the product. Client content lives in separate
site repos (one per client), and this engine operates on them.

The owner never edits anything. They message a request ("we're closed Monday",
"add this photo", "new price list"), get back a preview link and a screenshot, and
reply "yes" to publish or "no" to discard. The agent is effectively the CMS.

The WhatsApp front end (Hermes Agent) will be added later. It will NOT touch site
files or repos directly. It will only call the CLI tools in this repo. All logic,
validation and guardrails live here, so the front end can be swapped out.

## Architecture

### Engine (this repo)

- `schema/business.ts`: Zod schema for the business record, loosely modelled on
  schema.org LocalBusiness: name, description, address, geo, phone, email,
  opening hours (including special/holiday hours), services, prices, FAQs, team,
  gallery images (src + alt), social links, and page content blocks.
  Export the inferred TypeScript types and a JSON Schema version.
  Services must be booking-ready, because AI agents will book them later: stable
  `id`, name, category, description, price in pence, currency, priceType
  (fixed/from/consultation), durationMinutes, variants, requirements (patch test,
  consultation, deposit), practitionerId (optional, for multi-practitioner
  businesses), bookingUrl, bookingProvider, and a `verified` flag. Team members
  can each own their own services and booking details.
- `tools/extract-prices`: reads a price list image (or PDF) with Claude vision and
  returns schema-valid services marked `verified: false`, plus a review list of
  anything unclear. It is used during import and later whenever an owner sends a
  new price list over WhatsApp.
- `lib/build.ts`: validates a site's `business.json`, runs its AI-owned `src/index.ts`,
  injects JSON-LD, copies `src/assets/` and `public/`, and writes `dist/`. There is
  NO shared design across clients. The engine supplies plumbing, not presentation.
- `tools/`: TypeScript CLI tools (below), exposed through a single `fluidsite` bin.
- `lib/`: shared helpers (git operations, schema validation, image optimisation,
  Cloudflare API, Playwright screenshots).

### Site repos (one per client, separate GitHub repos)

- `business.json`: the single source of truth for all content.
- `SITE_BRIEF.md`: tone of voice, brand notes, things the agent must never change.
- `public/images/`: optimised images (WebP, max 2000px).
- `src/`: this site's HTML-producing code and assets. Fully owned by the AI agent.
  `src/index.ts` may produce any number of HTML pages without an engine change.
- `package.json`: depends on this engine via a pinned git tag, e.g.
  `"fluidsite-engine": "github:<owner>/fluidsite-engine#v0.1.0"`.
- Cloudflare Pages build command: `npx fluidsite build`, output dir `dist`.

### Principles

- Git is the database. Every change is a branch plus a commit. Approval is a merge
  to main. Rollback is git history.
- Cloudflare Pages: main is production, branches get preview URLs.
- Every content change goes through schema validation. Never free-form edits to
  generated HTML.
- Design is flexible, content is structured. The agent may freely change a site's
  `src/` (layout, styling, new page types, sections) when the owner asks, but
  site code must read all business facts (name, hours, prices, services, contact
  details, FAQs, images) from `business.json`. Never hardcode them in pages,
  because the record also feeds JSON-LD, Google Business Profile and MCP later.
  If a design request needs data the schema doesn't have, extend the schema
  rather than hardcoding it.
- Never delete images in place. Old files stay in git history.
- Site repos are pinned to engine tags, so engine changes never silently break a
  live site.

## CLI tools

All tools take `--site <path-or-git-url>` and return JSON on stdout so an agent can
call them.

- `fluidsite build`: render the site in the current directory to `dist/`.
- `fluidsite get-record`: print the current business.json.
- `fluidsite propose-change`: accept a structured JSON patch to the record, a
  free-text content instruction, or a free-text design instruction ("make it look
  more modern", "add a menu page", "move reviews to the top"). Free-text and design
  edits use Claude Code headless against the site repo. Every change must still
  produce a schema-valid record and a successful build, and design changes must
  pass a check that the rendered output's business facts come from the record (for
  example, change a field in a test render and confirm the output updates). Steps:
  validate, build, create a branch,
  commit, push, wait for the Cloudflare preview URL, take a Playwright screenshot.
  Returns `{ branch, previewUrl, screenshotPath, summary }`.
- `fluidsite apply-change --branch <name>`: merge to main, delete the branch.
- `fluidsite discard-change --branch <name>`: delete the branch.
- `fluidsite add-image --file <path>`: optimise with sharp (WebP, max 2000px),
  save to `public/images/` on a new branch, add to the gallery in business.json
  with generated alt text, then behave like propose-change.
- `fluidsite get-analytics`: weekly summary from the Cloudflare Web Analytics API.
  Stub until credentials are configured.

## This session's scope

The first client site (my cousin's) currently lives in its own repo as a static
export from the old Fluidsite builder, deployed on Cloudflare Pages. Its path will
be given to you.

1. Inspect the site repo's exported HTML/CSS/assets and summarise its structure.
2. Scaffold this engine repo: TypeScript, minimal dependencies, `fluidsite` bin.
3. Write the Zod schema.
4. Build the site compiler. Convert the current exported site into AI-owned source
   in the site repo's `src/` folder, so it renders visually identically from
   business.json. This is my cousin's design, not a default for other clients.
   JSON-LD is injected by the engine.
5. Write a one-off `fluidsite import` command that extracts the exported site's
   content into business.json and copies and optimises its images into
   `public/images/`. List anything ambiguous for me to confirm.
6. Implement get-record, propose-change (structured patches first), apply-change
   and discard-change fully. Stub add-image and get-analytics.
7. Tag v0.1.0.

Then give me the exact changes to make in the site repo: package.json, removal of
the old exported HTML once the rendered output matches, and the Cloudflare Pages
build settings.

## Constraints

- Keep dependencies minimal: zod, sharp, playwright, a git library or shell git,
  and the build plumbing. Nothing else without asking.
- The rendered site must look identical to the current one before the old HTML is
  removed.
- No secrets in code. Use `.env` with a committed `.env.example` (GitHub token,
  Cloudflare account ID and API token, Anthropic API key).
- Small, reviewable commits.

Start by inspecting both repos and giving me a short plan before changing anything.
