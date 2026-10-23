import type { CliArgs, CommandResult } from "../cli.ts";
import { build } from "../../renderer/build.ts";

/** `fluidsite build` — render the site to dist/. */
export async function buildCommand(args: CliArgs): Promise<CommandResult> {
  const outDir = typeof args.flags.out === "string" ? args.flags.out : "dist";
  const result = await build(args.site, outDir);
  return { ok: true, command: "build", ...result };
}
