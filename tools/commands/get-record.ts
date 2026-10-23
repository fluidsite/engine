import type { CliArgs, CommandResult } from "../cli.ts";
import { readRawRecord } from "../../lib/record.ts";

/** `fluidsite get-record` — print the current business.json verbatim. */
export async function getRecordCommand(args: CliArgs): Promise<CommandResult> {
  const record = await readRawRecord(args.site);
  return record as CommandResult;
}
