/**
 * JSON Merge Patch (RFC 7386) applied to the business record.
 *
 * A structured change is expressed as a partial object: present keys overwrite,
 * `null` deletes a key, and nested objects merge recursively. Arrays are
 * replaced wholesale (the record's arrays — team, services, hours — are edited
 * by sending the full new array), which keeps edits predictable for an agent.
 */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function applyMergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) return patch;
  const base: Record<string, unknown> = isObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete base[key];
    } else {
      base[key] = applyMergePatch(base[key], value);
    }
  }
  return base;
}
