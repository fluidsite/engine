import type { CliArgs, CommandResult } from "../cli.ts";
import { capabilities } from "../../lib/env.ts";

/**
 * Stub commands: the surface is defined and returns a clear, parseable
 * "not wired yet" result so an agent knows the command exists and what it needs,
 * rather than hitting an unknown-command error.
 */

/** `fluidsite add-image --file <path>` — optimise, add to gallery, propose-change. */
export async function addImageCommand(args: CliArgs): Promise<CommandResult> {
  return {
    ok: false,
    command: "add-image",
    status: "stub",
    message:
      "add-image is not implemented yet. Planned: optimise with sharp (WebP, max 2000px), " +
      "save to public/images/ on a new branch, add to the gallery in business.json with " +
      "generated alt text, then behave like propose-change.",
    received: { file: args.flags.file ?? null },
  };
}

/** `fluidsite get-analytics` — weekly Cloudflare Web Analytics summary. */
export async function getAnalyticsCommand(_args: CliArgs): Promise<CommandResult> {
  return {
    ok: false,
    command: "get-analytics",
    status: "stub",
    message:
      "get-analytics is not implemented yet. Planned: weekly summary from the Cloudflare " +
      "Web Analytics API once credentials are configured.",
    capabilities: capabilities(),
  };
}

/** `fluidsite extract-prices --file <image|pdf>` — Claude vision price-list extraction. */
export async function extractPricesCommand(args: CliArgs): Promise<CommandResult> {
  return {
    ok: false,
    command: "extract-prices",
    status: "stub",
    message:
      "extract-prices is not implemented yet. Planned: read a price-list image/PDF with " +
      "Claude vision and return schema-valid services marked verified:false, plus a review " +
      "list of anything unclear (used during import and for new price lists over WhatsApp).",
    received: { file: args.flags.file ?? null },
    capabilities: capabilities(),
  };
}
