/**
 * Script sibling-file helpers shared by every script-carrying codec.
 *
 * Invariant #9 (two-file scripts) holds at every level and for every
 * kind: script source never serializes into a manifest — it fans out
 * as one sibling file per slot beside the manifest, named by the slot
 * (`@openheaders/core/scripts` — `scriptSlotFile`): `pre-request.js` /
 * `post-response.js` for the HTTP pair, `<kind>.js` for a session
 * kind. A collection's or folder's siblings cover every kind; a
 * session request's cover its own kind's. The HTTP request codec
 * predates this module and keeps its own inline handling (its sibling
 * set also spans body/variables files).
 */

import {
  readScriptSlot,
  SCRIPT_KINDS,
  type ScriptKind,
  type ScriptSlotCarrier,
  scriptKindOfFile,
  scriptSlotFile,
  withScriptSlot,
} from '../../scripts/slots';

export interface ScriptSiblingFile {
  /** Filename relative to the entity's folder, e.g. "pre-request.js". */
  fileName: string;
  content: string;
}

/** The script fields a codec splices into or reads off an entity. */
export type ScriptFields = ScriptSlotCarrier;

/**
 * Fold the recognized script siblings into the entity's script fields
 * — the kinds the entity carries, every kind by default. Unrecognized
 * filenames are ignored (forward-compat, same posture as the request
 * codec's sibling loop).
 */
export function scriptFieldsFromSiblings(
  siblings: readonly ScriptSiblingFile[] | undefined,
  kinds: readonly ScriptKind[] = SCRIPT_KINDS,
): ScriptFields {
  const accepted: ReadonlySet<ScriptKind> = new Set(kinds);
  let out: ScriptFields = {};
  for (const sibling of siblings ?? []) {
    const kind = scriptKindOfFile(sibling.fileName);
    if (kind === null || !accepted.has(kind)) continue;
    out = withScriptSlot(out, kind, sibling.content);
  }
  return out;
}

/** Fan the entity's script fields out to their sibling files, in kind
 *  order — one file per slot the entity carries. */
export function scriptSiblingsFromFields(
  value: ScriptFields,
  kinds: readonly ScriptKind[] = SCRIPT_KINDS,
): ScriptSiblingFile[] {
  const files: ScriptSiblingFile[] = [];
  for (const kind of kinds) {
    const content = readScriptSlot(value, kind);
    if (content !== undefined) files.push({ fileName: scriptSlotFile(kind), content });
  }
  return files;
}
