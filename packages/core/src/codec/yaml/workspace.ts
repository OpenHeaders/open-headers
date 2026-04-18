/**
 * Workspace manifest codec (workspace.yaml).
 *
 * Layout (invariant #6 — metadata top, payload nested):
 *
 *   schemaVersion: 5
 *   uid: a1b2c3d4
 *   name: My API Project
 *   description: optional prose
 *   defaultEnvironmentId: staging8
 *
 * `rootPath` is runtime-only — populated after parse by whichever layer
 * knows the absolute workspace directory. The codec neither reads nor
 * writes it.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { WorkspaceSchema } from '../../schemas/workspace';
import type { Workspace } from '../../types/v5/workspace';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { WORKSPACE_FIELD_ORDER } from './ordering';

export function parseWorkspace(yaml: string): ParsedDocument<Workspace> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const value = v.parse(WorkspaceSchema, raw);
  return makeParsed(value, doc);
}

export function serializeWorkspace(write: WriteableDocument<Workspace>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, WORKSPACE_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, WORKSPACE_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
