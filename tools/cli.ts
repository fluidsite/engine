#!/usr/bin/env node
/**
 * fluidsite — single CLI entry point.
 *
 * Every subcommand takes a shared `--site <path-or-git-url>` flag and prints a
 * JSON result to stdout so an agent (or a human) can consume it. Errors are also
 * printed as JSON on stdout with a non-zero exit code, never as a raw stack trace,
 * so the caller always gets a parseable response.
 */

export interface CliArgs {
  /** The subcommand, e.g. "build", "get-record". */
  command: string;
  /** Resolved `--site` value (path or git URL). Defaults to the cwd. */
  site: string;
  /** All remaining flags as a map. Repeated flags keep the last value. */
  flags: Record<string, string | boolean>;
  /** Positional args after the command. */
  positionals: string[];
}

export type CommandResult = Record<string, unknown>;
export type CommandHandler = (args: CliArgs) => Promise<CommandResult>;

/**
 * Command registry. Handlers are added as each is implemented. Until then a
 * command resolves to a clear "not implemented" stub rather than crashing.
 *
 * Imports are deferred (dynamic) so a single failing command module never stops
 * the whole CLI from loading, and so `--help` stays dependency-free.
 */
const COMMANDS: Record<string, () => Promise<CommandHandler>> = {
  build: async () => (await import("./commands/build.ts")).buildCommand,
  "get-record": async () => (await import("./commands/get-record.ts")).getRecordCommand,
  "propose-change": async () => (await import("./commands/propose-change.ts")).proposeChangeCommand,
  "apply-change": async () => (await import("./commands/apply-change.ts")).applyChangeCommand,
  "discard-change": async () => (await import("./commands/discard-change.ts")).discardChangeCommand,
  "add-image": async () => (await import("./commands/stubs.ts")).addImageCommand,
  "get-analytics": async () => (await import("./commands/stubs.ts")).getAnalyticsCommand,
  "extract-prices": async () => (await import("./commands/stubs.ts")).extractPricesCommand,
};

const KNOWN_COMMANDS = [
  "build",
  "get-record",
  "propose-change",
  "apply-change",
  "discard-change",
  "add-image",
  "get-analytics",
  "extract-prices",
  "import",
] as const;

function parseArgs(argv: string[]): CliArgs {
  const [command = "", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(token);
    }
  }

  const site = typeof flags.site === "string" ? flags.site : process.cwd();
  return { command, site, flags, positionals };
}

function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function printHelp(): void {
  printJson({
    name: "fluidsite",
    usage: "fluidsite <command> --site <path-or-git-url> [options]",
    commands: KNOWN_COMMANDS,
    note: "All commands print JSON to stdout.",
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return;
  }

  const args = parseArgs(argv);

  if (!KNOWN_COMMANDS.includes(args.command as (typeof KNOWN_COMMANDS)[number])) {
    printJson({ ok: false, error: `Unknown command: ${args.command}`, commands: KNOWN_COMMANDS });
    process.exitCode = 2;
    return;
  }

  const loader = COMMANDS[args.command];
  if (!loader) {
    printJson({ ok: false, command: args.command, error: "Not implemented yet." });
    process.exitCode = 1;
    return;
  }

  try {
    const handler = await loader();
    const result = await handler(args);
    printJson(result);
  } catch (err) {
    printJson({
      ok: false,
      command: args.command,
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  }
}

void main();
