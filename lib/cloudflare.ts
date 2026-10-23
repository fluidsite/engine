/**
 * Cloudflare integration: resolve a branch's Pages preview URL and (later) pull
 * Web Analytics. Both need account credentials and live mode; without them these
 * return a clear "not wired" marker so the rest of the change flow still runs.
 */
import { credentials, liveMode } from "./env.ts";
import { NotWiredError } from "./errors.ts";

function ready(): boolean {
  const c = credentials();
  return liveMode() && !!c.cloudflareAccountId && !!c.cloudflareApiToken;
}

/**
 * Wait for the Cloudflare Pages preview deployment of a branch and return its URL.
 * Stubbed until credentials are wired: throws NotWiredError so callers can report
 * previewUrl: null with a reason.
 */
export async function waitForPreview(_project: string, _branch: string): Promise<string> {
  if (!ready()) {
    throw new NotWiredError(
      "Cloudflare preview",
      "set FLUIDSITE_LIVE=1 and CLOUDFLARE_* to poll Pages deployments",
    );
  }
  // TODO: poll GET /accounts/{id}/pages/projects/{project}/deployments and match
  // deployment_trigger.metadata.branch, then return latest_deployment.url.
  throw new NotWiredError("Cloudflare preview", "deployment polling not yet implemented");
}

/** Weekly analytics summary. Stub until credentials + GraphQL query are wired. */
export async function weeklyAnalytics(_siteHost: string): Promise<Record<string, unknown>> {
  if (!ready()) {
    throw new NotWiredError(
      "Cloudflare analytics",
      "set FLUIDSITE_LIVE=1 and CLOUDFLARE_* to query Web Analytics",
    );
  }
  throw new NotWiredError("Cloudflare analytics", "GraphQL query not yet implemented");
}
