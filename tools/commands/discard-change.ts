import { resolve } from "node:path";
import type { CliArgs, CommandResult } from "../cli.ts";
import * as git from "../../lib/git.ts";

/** `fluidsite discard-change --branch <name>` — delete the branch, keeping main. */
export async function discardChangeCommand(args: CliArgs): Promise<CommandResult> {
  const site = resolve(args.site);
  const branch = args.flags.branch;
  if (typeof branch !== "string") throw new Error("discard-change requires --branch <name>");

  const main = typeof args.flags.main === "string" ? args.flags.main : "main";
  const current = await git.currentBranch(site);
  if (current === branch) await git.checkout(site, main);
  await git.deleteBranch(site, branch, true);

  return { ok: true, command: "discard-change", branch, discarded: true };
}
