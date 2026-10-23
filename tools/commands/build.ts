import type { CliArgs, CommandResult } from "../cli.ts";
import { build } from "../../lib/build.ts";
import { FluidsiteError } from "../../lib/errors.ts";

/** `fluidsite build` — build the site to dist/. */
export async function buildCommand(args: CliArgs): Promise<CommandResult> {
  if (args.flags.out !== undefined) {
    throw new FluidsiteError("fluidsite build always writes to dist/; --out is not supported");
  }
  const result = await build(args.site);
  return { ok: true, command: "build", ...result };
}
