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
 *
 * `orgId` is host-local tenancy context and never manifest content
 * (the git-sync plan §5): serialize never emits it, and parse drops it
 * without capturing an unknown row — a manifest that still carries one
 * normalizes clean on the next write. The binding host injects its own
 * Org when it consumes the parsed manifest.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { WorkspaceManifestSchema } from '../../schemas/workspace';
import type { WorkspaceManifest } from '../../types/workspace';
import { emitCanonicalYaml } from './canonical-emit';
import { WORKSPACE_FIELD_ORDER } from './ordering';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

const ORG_ID_POINTER = '/orgId';

export function parseWorkspace(yaml: string): ParsedDocument<WorkspaceManifest> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  delete raw.orgId;
  const value = v.parse(WorkspaceManifestSchema, raw);
  return makeParsed(value, extractUnknownFields(raw, WorkspaceManifestSchema, WORKSPACE_FIELD_ORDER));
}

export function serializeWorkspace(write: WriteableDocument<WorkspaceManifest>): string {
  const rows = unknownFieldsOf(write).filter((row) => row.path !== ORG_ID_POINTER);
  return emitCanonicalYaml(write.value, WorkspaceManifestSchema, WORKSPACE_FIELD_ORDER, rows);
}
