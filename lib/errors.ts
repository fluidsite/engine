/** Base error for engine failures that should surface as a clean JSON message. */
export class FluidsiteError extends Error {
  override name = "FluidsiteError";
}

/** A capability that needs credentials or live mode and isn't available yet. */
export class NotWiredError extends FluidsiteError {
  override name = "NotWiredError";
  constructor(capability: string, hint?: string) {
    super(`${capability} is not wired${hint ? `: ${hint}` : "."}`);
  }
}

/** The business record failed schema validation. Carries a readable summary. */
export class ValidationError extends FluidsiteError {
  override name = "ValidationError";
  constructor(public readonly summary: string) {
    super(`Record failed validation:\n${summary}`);
  }
}
