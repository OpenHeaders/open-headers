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
 * `path` is the folder's relative location on disk — runtime-only,
 * supplied by the caller (the directory walker knows it). Injected into
 * the parsed value so schema validation (which requires `path`)
 * succeeds; stripped on serialize via the canonical field order.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { CollectionSchema } from '../../schemas/collection';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import type { Collection } from '../../types/v5/collection';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { COLLECTION_FIELD_ORDER } from './ordering';

export interface CollectionCodecContext {
  /** Workspace-relative folder path, e.g. "requests/auth-a1b2c3d4". */
  path: string;
}

export function parseCollection(yaml: string, context: CollectionCodecContext): ParsedDocument<Collection> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path };
  const value = v.parse(CollectionSchema, merged);
  return makeParsed(value, doc);
}

export function serializeCollection(write: WriteableDocument<Collection>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, COLLECTION_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, COLLECTION_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
