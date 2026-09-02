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
 * one sibling per script slot — `pre-request.js` / `post-response.js`
 * for the HTTP pair, `<kind>.js` for every session kind — carries the
 * folder's ancestor script slots; the YAML never holds script source.
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
import { type ScriptSiblingFile, scriptFieldsFromSiblings, scriptSiblingsFromFields } from './script-siblings';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

export interface FolderCodecContext {
  /** Workspace-relative folder path. */
  path: string;
  /** Sibling files the caller found beside `_folder.yaml`. The codec
   *  recognizes every script slot's sibling (`pre-request.js`,
   *  `ws-before-connect.js`, …) and ignores the rest (request
   *  subfolders are directories, not siblings). */
  siblings?: readonly ScriptSiblingFile[];
}

export function parseFolder(yaml: string, context: FolderCodecContext): ParsedDocument<Folder> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path, ...scriptFieldsFromSiblings(context.siblings) };
  const value = v.parse(FolderSchema, merged);
  return makeParsed(value, extractUnknownFields(raw, FolderSchema, FOLDER_FIELD_ORDER));
}

export interface FolderSerializeOutput {
  /** `_folder.yaml` contents. */
  folderYaml: string;
  /** One sibling per script slot the folder carries, in kind order. */
  scriptFiles: ScriptSiblingFile[];
}

export function serializeFolder(write: WriteableDocument<Folder>): FolderSerializeOutput {
  return {
    folderYaml: emitCanonicalYaml(write.value, FolderSchema, FOLDER_FIELD_ORDER, unknownFieldsOf(write)),
    scriptFiles: scriptSiblingsFromFields(write.value),
  };
}
