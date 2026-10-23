/**
 * Playwright screenshots of a preview URL. Gated behind live mode; Playwright is
 * imported lazily so typechecking and offline commands never require a browser
 * binary to be installed.
 */
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { liveMode } from "./env.ts";
import { NotWiredError } from "./errors.ts";

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
}

export async function screenshot(
  url: string,
  destPath: string,
  opts: ScreenshotOptions = {},
): Promise<{ path: string }> {
  if (!liveMode()) {
    throw new NotWiredError("screenshot", "set FLUIDSITE_LIVE=1 to capture Playwright screenshots");
  }

  const { chromium } = await import("playwright");
  await mkdir(dirname(destPath), { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: opts.width ?? 1280, height: opts.height ?? 800 },
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.screenshot({ path: destPath, fullPage: opts.fullPage ?? true });
    return { path: destPath };
  } finally {
    await browser.close();
  }
}
