/**
 * Credential + mode helpers. The engine runs fully locally by default; anything
 * that touches an external service (git push, Cloudflare, Playshot, Anthropic) is
 * gated behind `liveMode()` and the presence of the relevant credential, so a
 * missing key degrades to a clear "not wired" result instead of a crash.
 */

/**
 * Live mode enables outward-facing actions (push, Cloudflare preview polling,
 * screenshots). Off by default; set FLUIDSITE_LIVE=1 to enable.
 */
export function liveMode(): boolean {
  const v = process.env.FLUIDSITE_LIVE;
  return v === "1" || v === "true";
}

export interface Credentials {
  githubToken?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  anthropicApiKey?: string;
}

export function credentials(): Credentials {
  return {
    githubToken: process.env.GITHUB_TOKEN || undefined,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || undefined,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  };
}

/** Which capabilities are currently available, for diagnostics. */
export function capabilities(): Record<string, boolean> {
  const c = credentials();
  return {
    live: liveMode(),
    github: !!c.githubToken,
    cloudflare: !!(c.cloudflareAccountId && c.cloudflareApiToken),
    anthropic: !!c.anthropicApiKey,
  };
}
