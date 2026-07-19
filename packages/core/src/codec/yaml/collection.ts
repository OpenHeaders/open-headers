/**
 * Collection codec (_collection.yaml).
 *
 * Layout:
 *
 *   schemaVersion: 5
 *   uid: a1b2c3d4
 *   name: Auth
 *   description: optional
 *   order: [login-x7k2abcd, refresh-m9p1qwer]    # explicit child ordering
 *   variables:
 *     - name: API_URL
 *       value: https://api.example.com
 *       type: default
 *
 * Scripts fan out beside the manifest (invariant #9, two-file scripts):
 * `pre-request.js` / `post-response.js` siblings carry the collection's
 * ancestor script slots; the YAML never holds script source. The caller
 * lists the siblings it found on parse and writes the files serialize
 * returns.
 *
 * `path` is the folder's relative location on disk — runtime-only,
 * supplied by the caller (the directory walker knows it). Injected into
 * the parsed value so schema validation (which requires `path`)
 * succeeds; stripped on serialize via the canonical field order.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { CollectionSchema } from '../../schemas/collection';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import type { Collection } from '../../types/collection';
import { emitCanonicalYaml } from './canonical-emit';
import { COLLECTION_FIELD_ORDER } from './ordering';
import {
  type ScriptSiblingFile,
  type ScriptSiblingOutputs,
  scriptFieldsFromSiblings,
  scriptSiblingsFromFields,
} from './script-siblings';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

export interface CollectionCodecContext {
  /** Workspace-relative folder path, e.g. "requests/auth-a1b2c3d4". */
  path: string;
  /** Sibling files the caller found beside `_collection.yaml`. The codec
   *  recognizes `pre-request.js` / `post-response.js` and ignores the
   *  rest (request subfolders are directories, not siblings). */
  siblings?: readonly ScriptSiblingFile[];
}

export function parseCollection(yaml: string, context: CollectionCodecContext): ParsedDocument<Collection> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path, ...scriptFieldsFromSiblings(context.siblings) };
  const value = v.parse(CollectionSchema, merged);
  return makeParsed(value, extractUnknownFields(raw, CollectionSchema, COLLECTION_FIELD_ORDER));
}

export interface CollectionSerializeOutput extends ScriptSiblingOutputs {
  /** `_collection.yaml` contents. */
  collectionYaml: string;
}

export function serializeCollection(write: WriteableDocument<Collection>): CollectionSerializeOutput {
  // Treat schema defaults as absent so a round-trip through the codec
  // produces byte-identical YAML when the original had no pinned-envs
  // / default-env keys. Empty list and `null` default mean the same
  // thing as "key omitted" in our model; the parser refills defaults
  // on the next read.
  const normalized = omitCollectionDefaults(write.value);
  return {
    collectionYaml: emitCanonicalYaml(normalized, CollectionSchema, COLLECTION_FIELD_ORDER, unknownFieldsOf(write)),
    ...scriptSiblingsFromFields(write.value),
  };
}

function omitCollectionDefaults(value: Collection): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  if (Array.isArray(out.pinnedEnvironmentIds) && out.pinnedEnvironmentIds.length === 0) {
    delete out.pinnedEnvironmentIds;
  }
  if (out.defaultEnvironmentId === null) {
    delete out.defaultEnvironmentId;
  }
  return out;
}
