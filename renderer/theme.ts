/**
 * The contract between the engine and a site's own theme.
 *
 * A site owns its design in `theme/`. The engine loads the theme's entry module
 * and calls `renderPage` with the validated record plus helpers, then injects
 * JSON-LD and copies the theme's declared assets. There is no shared design: each
 * theme is the site's own.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Business } from "../schema/business.ts";
import { helpers, type Helpers } from "./helpers.ts";
import { FluidsiteError } from "../lib/errors.ts";

export interface RenderContext {
  business: Business;
  helpers: Helpers;
}

export interface Theme {
  /** Return the full HTML document. The engine injects JSON-LD into <head>. */
  renderPage(ctx: RenderContext): string | Promise<string>;
  /**
   * Paths relative to `theme/` to copy into the build output root (CSS, fonts,
   * client scripts), e.g. ["styles.css", "fonts", "scripts"].
   */
  assets?: string[];
}

const ENTRY_CANDIDATES = ["index.ts", "index.js", "index.mjs"];

/** Resolve and import a site's theme entry module. */
export async function loadTheme(sitePath: string): Promise<Theme> {
  const themeDir = join(resolve(sitePath), "theme");
  if (!existsSync(themeDir)) {
    throw new FluidsiteError(`No theme/ folder found at ${themeDir}`);
  }
  const entry = ENTRY_CANDIDATES.map((f) => join(themeDir, f)).find((p) => existsSync(p));
  if (!entry) {
    throw new FluidsiteError(
      `theme/ has no entry module (expected one of: ${ENTRY_CANDIDATES.join(", ")})`,
    );
  }

  const mod = (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
  const theme = (mod.default ?? mod) as Partial<Theme>;
  if (typeof theme.renderPage !== "function") {
    throw new FluidsiteError(`theme entry ${entry} does not export renderPage(ctx)`);
  }
  return theme as Theme;
}

/** Build a render context for a theme. */
export function renderContext(business: Business): RenderContext {
  return { business, helpers };
}
