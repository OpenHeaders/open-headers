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
 * Scripts fan out beside the manifest (invariant #9, two-file scripts):
 * `pre-request.js` / `post-response.js` siblings carry the folder's
 * ancestor script slots; the YAML never holds script source.
 *
 * `path` is runtime-only — the folder's workspace-relative location,
 * supplied by the caller at parse time. Stripped on serialize.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { FolderSchema } from '../../schemas/collection';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import type { Folder } from '../../types/collection';
import { emitCanonicalYaml } from './canonical-emit';
import { FOLDER_FIELD_ORDER } from './ordering';
import {
  type ScriptSiblingFile,
  type ScriptSiblingOutputs,
  scriptFieldsFromSiblings,
  scriptSiblingsFromFields,
} from './script-siblings';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

export interface FolderCodecContext {
  /** Workspace-relative folder path. */
  path: string;
  /** Sibling files the caller found beside `_folder.yaml`. The codec
   *  recognizes `pre-request.js` / `post-response.js` and ignores the
   *  rest (request subfolders are directories, not siblings). */
  siblings?: readonly ScriptSiblingFile[];
}

export function parseFolder(yaml: string, context: FolderCodecContext): ParsedDocument<Folder> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path, ...scriptFieldsFromSiblings(context.siblings) };
  const value = v.parse(FolderSchema, merged);
  return makeParsed(value, extractUnknownFields(raw, FolderSchema, FOLDER_FIELD_ORDER));
}

export interface FolderSerializeOutput extends ScriptSiblingOutputs {
  /** `_folder.yaml` contents. */
  folderYaml: string;
}

export function serializeFolder(write: WriteableDocument<Folder>): FolderSerializeOutput {
  return {
    folderYaml: emitCanonicalYaml(write.value, FolderSchema, FOLDER_FIELD_ORDER, unknownFieldsOf(write)),
    ...scriptSiblingsFromFields(write.value),
  };
}
