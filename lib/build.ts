/** Build an AI-owned site from business.json, src/, and public/ into dist/. */
import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readRecord } from "./record.ts";
import { loadSiteSource, siteBuildContext } from "./site.ts";
import { renderJsonLdScript } from "./jsonld.ts";
import { FluidsiteError } from "./errors.ts";
import type { Business } from "../schema/business.ts";

export interface BuildResult {
  outDir: string;
  htmlBytes: number;
  pagesWritten: string[];
  assetsCopied: boolean;
  publicCopied: boolean;
}

/** Insert the JSON-LD script before </head> (or prepend if there is no head). */
export function injectJsonLd(html: string, business: Business): string {
  const script = renderJsonLdScript(business);
  return html.includes("</head>") ? html.replace("</head>", `${script}</head>`) : script + html;
}

function safeOutputPath(root: string, pagePath: string): string {
  if (!pagePath || isAbsolute(pagePath)) {
    throw new FluidsiteError(`Invalid output page path: ${pagePath || "(empty)"}`);
  }
  const output = resolve(root, pagePath);
  const withinRoot = relative(root, output);
  if (withinRoot === ".." || withinRoot.startsWith(`..${sep}`)) {
    throw new FluidsiteError(`Output page escapes dist/: ${pagePath}`);
  }
  if (!pagePath.endsWith(".html")) {
    throw new FluidsiteError(`Output page must end in .html: ${pagePath}`);
  }
  return output;
}

export async function build(sitePath: string, outDirName = "dist"): Promise<BuildResult> {
  const root = resolve(sitePath);
  const outDir = join(root, outDirName);
  const business = await readRecord(root);
  const source = await loadSiteSource(root);
  const pages = await source.build(siteBuildContext(business));

  if (!pages || typeof pages !== "object" || Array.isArray(pages)) {
    throw new FluidsiteError("src/index must return an object mapping HTML paths to strings");
  }
  if (typeof pages["index.html"] !== "string") {
    throw new FluidsiteError("src/index must return an index.html page");
  }

  const stagingDir = await mkdtemp(join(root, ".fluidsite-build-"));
  try {
    const assetsDir = join(root, "src", "assets");
    const assetsCopied = existsSync(assetsDir);
    if (assetsCopied) await cp(assetsDir, stagingDir, { recursive: true });

    const publicDir = join(root, "public");
    const publicCopied = existsSync(publicDir);
    if (publicCopied) await cp(publicDir, join(stagingDir, "public"), { recursive: true });

    const pagesWritten = Object.keys(pages).sort();
    for (const pagePath of pagesWritten) {
      const html = pages[pagePath];
      if (typeof html !== "string") {
        throw new FluidsiteError(`Output page must be a string: ${pagePath}`);
      }
      const destination = safeOutputPath(stagingDir, pagePath);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(
        destination,
        pagePath === "index.html" ? injectJsonLd(html, business) : html,
        "utf8",
      );
    }

    const { size: htmlBytes } = await stat(join(stagingDir, "index.html"));
    await rm(outDir, { recursive: true, force: true });
    await rename(stagingDir, outDir);
    return { outDir, htmlBytes, pagesWritten, assetsCopied, publicCopied };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}
