/**
 * Folder codec (_folder.yaml).
 *
 * Layout:
 *
 *   schemaVersion: 5
 *   uid: a1b2c3d4
 *   name: Tokens
 *   order: [refresh-m9p1qwer, introspect-p2q3rstu]
 *
 * `path` is runtime-only — the folder's workspace-relative location,
 * supplied by the caller at parse time. Stripped on serialize.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { FolderSchema } from '../../schemas/collection';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import type { Folder } from '../../types/collection';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { FOLDER_FIELD_ORDER } from './ordering';

export interface FolderCodecContext {
  /** Workspace-relative folder path. */
  path: string;
}

export function parseFolder(yaml: string, context: FolderCodecContext): ParsedDocument<Folder> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path };
  const value = v.parse(FolderSchema, merged);
  return makeParsed(value, doc);
}

export function serializeFolder(write: WriteableDocument<Folder>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, FOLDER_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, FOLDER_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
