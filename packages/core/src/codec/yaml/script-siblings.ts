/**
 * Script sibling-file helpers shared by the collection + folder codecs.
 *
 * Invariant #9 (two-file scripts) extends to ancestor levels: a
 * collection's / folder's `preRequestScript` / `postResponseScript`
 * never serialize into `_collection.yaml` / `_folder.yaml` — they fan
 * out as `pre-request.js` / `post-response.js` sibling files, exactly
 * like a request's scripts beside `request.yaml`. The request codec
 * predates this module and keeps its own inline handling (its sibling
 * set also spans body/variables files); the two ancestor codecs share
 * this one.
 */

export interface ScriptSiblingFile {
  /** Filename relative to the entity's folder, e.g. "pre-request.js". */
  fileName: string;
  content: string;
}

export const PRE_REQUEST_SCRIPT_FILE = 'pre-request.js';
export const POST_RESPONSE_SCRIPT_FILE = 'post-response.js';

export interface ScriptFields {
  preRequestScript?: string;
  postResponseScript?: string;
}

/**
 * Fold the recognized script siblings into the two script fields.
 * Unrecognized filenames are ignored (forward-compat, same posture as
 * the request codec's sibling loop).
 */
export function scriptFieldsFromSiblings(siblings: readonly ScriptSiblingFile[] | undefined): ScriptFields {
  const out: ScriptFields = {};
  for (const sibling of siblings ?? []) {
    if (sibling.fileName === PRE_REQUEST_SCRIPT_FILE) out.preRequestScript = sibling.content;
    else if (sibling.fileName === POST_RESPONSE_SCRIPT_FILE) out.postResponseScript = sibling.content;
  }
  return out;
}

export interface ScriptSiblingOutputs {
  /** `pre-request.js` when the entity has a pre-request script. */
  preRequestScript: ScriptSiblingFile | null;
  /** `post-response.js` when the entity has a post-response script. */
  postResponseScript: ScriptSiblingFile | null;
}

/** Fan the script fields out to their sibling files (null when absent). */
export function scriptSiblingsFromFields(value: ScriptFields): ScriptSiblingOutputs {
  return {
    preRequestScript:
      value.preRequestScript !== undefined
        ? { fileName: PRE_REQUEST_SCRIPT_FILE, content: value.preRequestScript }
        : null,
    postResponseScript:
      value.postResponseScript !== undefined
        ? { fileName: POST_RESPONSE_SCRIPT_FILE, content: value.postResponseScript }
        : null,
  };
}
