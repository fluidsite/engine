/**
 * Build a site: combine its business.json with its theme into static HTML in
 * `dist/`. The engine loads + validates the record, renders the theme, always
 * injects JSON-LD, and copies the theme's assets and the site's public/ folder.
 */
import { cp, mkdir, rm, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { readRecord } from "../lib/record.ts";
import { loadTheme, renderContext } from "./theme.ts";
import { renderJsonLdScript } from "./jsonld.ts";
import type { Business } from "../schema/business.ts";

export interface BuildResult {
  outDir: string;
  htmlBytes: number;
  assetsCopied: string[];
  publicCopied: boolean;
}

/** Insert the JSON-LD script before </head> (or prepend if there's no head). */
export function injectJsonLd(html: string, business: Business): string {
  const script = renderJsonLdScript(business);
  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }
  return script + html;
}

export async function build(sitePath: string, outDirName = "dist"): Promise<BuildResult> {
  const root = resolve(sitePath);
  const outDir = join(root, outDirName);

  const business = await readRecord(root);
  const theme = await loadTheme(root);

  let html = await theme.renderPage(renderContext(business));
  html = injectJsonLd(html, business);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await writeFile(join(outDir, "index.html"), html, "utf8");

  // Copy the theme's declared assets (CSS, fonts, scripts) into the output root.
  const assetsCopied: string[] = [];
  const themeDir = join(root, "theme");
  for (const asset of theme.assets ?? []) {
    const from = join(themeDir, asset);
    if (existsSync(from)) {
      await cp(from, join(outDir, asset), { recursive: true });
      assetsCopied.push(asset);
    }
  }

  // Copy the site's public/ folder (images, etc.) into dist/public.
  const publicDir = join(root, "public");
  const publicCopied = existsSync(publicDir);
  if (publicCopied) {
    await cp(publicDir, join(outDir, "public"), { recursive: true });
  }

  const { size } = await stat(join(outDir, "index.html"));
  return { outDir, htmlBytes: size, assetsCopied, publicCopied };
}
