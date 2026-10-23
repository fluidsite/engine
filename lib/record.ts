/**
 * Read, validate and write a site's business.json.
 *
 * `readRecord` returns a fully-parsed, defaulted `Business`. `readRawRecord`
 * returns the file's JSON verbatim (for `get-record`, which should echo what's on
 * disk). `writeRecord` validates before writing and always pretty-prints.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { businessSchema, type Business } from "../schema/business.ts";
import { ValidationError, FluidsiteError } from "./errors.ts";

export function recordPath(sitePath: string): string {
  return join(resolve(sitePath), "business.json");
}

/** Validate an in-memory value, throwing a readable ValidationError on failure. */
export function validateRecord(value: unknown): Business {
  const result = businessSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(z.prettifyError(result.error));
  }
  return result.data;
}

/** Parse the raw JSON on disk without schema validation. */
export async function readRawRecord(sitePath: string): Promise<unknown> {
  const path = recordPath(sitePath);
  if (!existsSync(path)) {
    throw new FluidsiteError(`No business.json found at ${path}`);
  }
  const text = await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new FluidsiteError(
      `business.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Read and validate the record, returning a defaulted Business. */
export async function readRecord(sitePath: string): Promise<Business> {
  return validateRecord(await readRawRecord(sitePath));
}

/** Validate then write the record (pretty-printed, trailing newline). */
export async function writeRecord(sitePath: string, value: unknown): Promise<Business> {
  const record = validateRecord(value);
  await writeFile(recordPath(sitePath), JSON.stringify(record, null, 2) + "\n", "utf8");
  return record;
}
