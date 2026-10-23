/**
 * Local git operations over a site repo, via the `git` binary.
 *
 * Local history operations (branch, commit, merge, delete) always run. Anything
 * that reaches the network — `push` — is gated behind live mode and returns a
 * clear "not wired" result otherwise, so the change flow works offline.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { liveMode } from "./env.ts";
import { NotWiredError } from "./errors.ts";

const run = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: resolve(cwd), maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

export async function currentBranch(cwd: string): Promise<string> {
  return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export async function hasChanges(cwd: string): Promise<boolean> {
  return (await git(cwd, ["status", "--porcelain"])).length > 0;
}

export async function createBranch(cwd: string, branch: string): Promise<void> {
  await git(cwd, ["checkout", "-b", branch]);
}

export async function checkout(cwd: string, branch: string): Promise<void> {
  await git(cwd, ["checkout", branch]);
}

export async function addAll(cwd: string): Promise<void> {
  await git(cwd, ["add", "-A"]);
}

export async function commit(cwd: string, message: string): Promise<string> {
  await git(cwd, ["commit", "-m", message]);
  return git(cwd, ["rev-parse", "HEAD"]);
}

/** Fast-forward/merge a branch into main and return to main. */
export async function mergeToMain(cwd: string, branch: string, main = "main"): Promise<void> {
  await checkout(cwd, main);
  await git(cwd, ["merge", "--no-ff", branch, "-m", `Merge ${branch}`]);
}

export async function deleteBranch(cwd: string, branch: string, force = false): Promise<void> {
  await git(cwd, ["branch", force ? "-D" : "-d", branch]);
}

/** Push a branch. Network op: gated behind live mode. */
export async function push(cwd: string, branch: string, remote = "origin"): Promise<{ pushed: boolean }> {
  if (!liveMode()) {
    throw new NotWiredError("git push", "set FLUIDSITE_LIVE=1 to push branches");
  }
  await git(cwd, ["push", "-u", remote, branch]);
  return { pushed: true };
}
