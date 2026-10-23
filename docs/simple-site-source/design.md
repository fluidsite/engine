# Simple AI-Owned Site Source

> **Status:** Proposed for review

## 1. Requirements: what and why

Fluidsite sites are maintained by an AI agent, not by people choosing templates or editing a CMS. The repository structure should reflect that. The AI needs one obvious place to change the site's HTML, CSS, JavaScript, and pages, while structured business facts remain reliable for validation, search metadata, integrations, and future booking tools.

The system must preserve these invariants:

- **INV-1:** `business.json` is the single source of truth for business facts such as names, hours, services, prices, contact details, team members, and images.
- **INV-2:** A successful build always validates `business.json`, produces `dist/index.html`, and injects valid structured data.
- **INV-3:** Site-specific presentation stays in the site repository. The engine does not impose a shared design.
- **INV-4:** Adding a page or asset does not require changing the engine.

The current public concepts of an engine `renderer/`, a site `theme/`, and an explicit asset list are unnecessary. Internally, some code must still coordinate a build, but site authors and AI agents do not need to understand a renderer/theme abstraction.

## 2. User experience

Every site repository has this shape:

```text
business.json
src/
  index.ts
  styles.css
  site.js
  fonts/
public/
  images/
package.json
```

The owner asks for a change in natural language. The agent updates `business.json` when facts change and updates `src/` when presentation or behavior changes. It then runs `npx fluidsite build`, receives a preview, and asks for approval.

`src/index.ts` is the site's build entry point. It may create one page or many pages. Adding a new page is a site-only change, for example returning `services/index.html` alongside `index.html`. Files placed under `src/assets/` are copied to the root of `dist/`; files under `public/` are copied to `dist/public/`. No asset manifest needs to be maintained.

If the record is invalid, the site entry point is missing, no home page is produced, or the build throws, the command fails without publishing partial output. The agent fixes the source and rebuilds.

## 3. Technical design and choices

### Public site contract

Replace the `theme/` contract with one site-owned entry point:

```ts
export function build(ctx: SiteBuildContext): Record<string, string>
```

The returned object maps output paths to HTML, for example:

```ts
{
  "index.html": renderHome(ctx.business),
  "services/index.html": renderServices(ctx.business)
}
```

This is deliberately code rather than a template language. The AI can create any markup or page structure without waiting for engine support. The context supplies the validated business record and small escaping/image helpers. Type-only imports keep the contract discoverable.

The engine recursively copies `src/assets/` to `dist/` and `public/` to `dist/public/`. CSS, browser JavaScript, fonts, `_redirects`, and similar files therefore require no declaration. `src/index.ts` itself is never copied.

### Engine responsibility

The engine still needs a build coordinator, but it should be an internal implementation detail named `lib/build.ts`, not a product-level renderer. `fluidsite build` performs these steps:

1. Validate `business.json`.
2. Load `src/index.ts`.
3. Render all returned pages in memory.
4. Require `index.html` and inject JSON-LD into it.
5. Build into a temporary directory.
6. Copy automatic assets.
7. Replace `dist/` only after every step succeeds.

Building in a temporary directory prevents a failed AI edit from leaving a partly updated deployable directory.

The site entry already executes repository-owned TypeScript under the current theme design, so this proposal does not expand the trust boundary. Only reviewed repository code runs in Cloudflare's build environment.

### Migration

Move `theme/index.ts` to `src/index.ts`. Move CSS, scripts, fonts, and `_redirects` under `src/assets/`, remove the exported asset array, and rename `renderPage` to `build`. Keep `business.json` and `public/images/` unchanged. Remove the old theme loader after the first site builds identically under the new contract.

## 4. Acceptance and proof

| ID | Done when | How to check |
|---|---|---|
| AC-1 | A site has no `theme/` directory or asset manifest | Repository structure assertion |
| AC-2 | `npx fluidsite build` produces the existing salon site from `src/` | Build plus desktop/mobile browser comparison |
| AC-3 | A second HTML page can be added without an engine change | Fixture returning two page paths |
| AC-4 | New files under `src/assets/` and `public/` appear in their documented output locations | Automated copy test |
| AC-5 | Invalid data or a thrown site build leaves the previous `dist/` intact | Failure-path integration tests |
| AC-6 | INV-1 through INV-4 hold | Record mutation test, JSON-LD assertion, and site fixture tests |

## 5. Open questions

None. Recommended decision: adopt this contract before adding a second client site, while migration cost is small.
