import { resolve } from "node:path";
import type { CliArgs, CommandResult } from "../cli.ts";
import * as git from "../../lib/git.ts";

/** `fluidsite apply-change --branch <name>` — merge to main and delete the branch. */
export async function applyChangeCommand(args: CliArgs): Promise<CommandResult> {
  const site = resolve(args.site);
  const branch = args.flags.branch;
  if (typeof branch !== "string") throw new Error("apply-change requires --branch <name>");

  const main = typeof args.flags.main === "string" ? args.flags.main : "main";
  await git.mergeToMain(site, branch, main);
  await git.deleteBranch(site, branch, true);

  return { ok: true, command: "apply-change", branch, mergedInto: main };
}
