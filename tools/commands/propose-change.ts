import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CliArgs, CommandResult } from "../cli.ts";
import { readRecord, writeRecord } from "../../lib/record.ts";
import { applyMergePatch } from "../../lib/patch.ts";
import { build } from "../../renderer/build.ts";
import { NotWiredError } from "../../lib/errors.ts";
import * as git from "../../lib/git.ts";
import { waitForPreview } from "../../lib/cloudflare.ts";
import { screenshot } from "../../lib/screenshot.ts";

/**
 * `fluidsite propose-change` — apply a structured JSON merge patch to the record,
 * validate, build, and create a branch + commit. Pushing, waiting for the
 * Cloudflare preview and taking a screenshot run only in live mode; otherwise
 * they are reported as not-wired and the local branch is still produced.
 *
 * Flags:
 *   --patch <file.json>   JSON merge patch to apply (required for structured edits)
 *   --instruction <text>  free-text/design edit (Claude Code headless) — not yet wired
 *   --message <text>      commit message / change summary
 */
export async function proposeChangeCommand(args: CliArgs): Promise<CommandResult> {
  const site = resolve(args.site);

  if (typeof args.flags.instruction === "string") {
    throw new NotWiredError(
      "free-text/design propose-change",
      "Claude Code headless edits are not yet wired; use --patch for structured edits",
    );
  }

  if (typeof args.flags.patch !== "string") {
    throw new Error("propose-change requires --patch <file.json> (a JSON merge patch)");
  }

  const patch = JSON.parse(await readFile(resolve(args.flags.patch), "utf8"));
  const current = await readRecord(site);
  const next = applyMergePatch(current, patch);

  // Validate + write, then prove it builds before committing.
  await writeRecord(site, next);
  await build(site);

  const summary =
    typeof args.flags.message === "string" ? args.flags.message : "Update business record";
  const branch = `change/${Date.now()}`;

  await git.createBranch(site, branch);
  await git.addAll(site);
  const sha = await git.commit(site, summary);

  // Outward-facing steps: only in live mode.
  let previewUrl: string | null = null;
  let screenshotPath: string | null = null;
  const notes: string[] = [];
  try {
    await git.push(site, branch);
    previewUrl = await waitForPreview(args.flags.project as string, branch);
    const dest = resolve(site, "screenshots", `${branch.replace(/\//g, "-")}.png`);
    screenshotPath = (await screenshot(previewUrl, dest)).path;
  } catch (err) {
    notes.push(err instanceof NotWiredError ? err.message : String(err));
  }

  return { ok: true, command: "propose-change", branch, sha, summary, previewUrl, screenshotPath, notes };
}
