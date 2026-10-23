/** The small contract between the engine and an AI-owned site repository. */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";
import type { Business } from "../schema/business.ts";
import { helpers, type Helpers } from "./helpers.ts";
import { FluidsiteError } from "./errors.ts";

export interface SiteBuildContext {
  business: Business;
  helpers: Helpers;
}

export type SitePages = Record<string, string>;

export interface SiteSource {
  build(ctx: SiteBuildContext): SitePages | Promise<SitePages>;
}

const ENTRY_CANDIDATES = ["index.ts", "index.js", "index.mjs"];

/** Load the site's single source entry point from src/. */
export async function loadSiteSource(sitePath: string): Promise<SiteSource> {
  const sourceDir = join(resolve(sitePath), "src");
  if (!existsSync(sourceDir)) {
    throw new FluidsiteError(`No src/ folder found at ${sourceDir}`);
  }

  const entry = ENTRY_CANDIDATES.map((file) => join(sourceDir, file)).find((file) =>
    existsSync(file),
  );
  if (!entry) {
    throw new FluidsiteError(
      `src/ has no entry module (expected one of: ${ENTRY_CANDIDATES.join(", ")})`,
    );
  }

  const entryUrl = pathToFileURL(entry).href;
  const mod = (entry.endsWith(".ts")
    ? await tsImport(entryUrl, import.meta.url)
    : await import(entryUrl)) as Record<string, unknown>;
  const source = (mod.default ?? mod) as Partial<SiteSource>;
  if (typeof source.build !== "function") {
    throw new FluidsiteError(`site entry ${entry} does not export build(ctx)`);
  }
  return source as SiteSource;
}

export function siteBuildContext(business: Business): SiteBuildContext {
  return { business, helpers };
}
