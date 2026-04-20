/**
 * Live Workflow codec (`workflow.yaml`).
 *
 * A workflow persists as a single file under
 * `live-workflows/<slug>-<uid>/workflow.yaml`. The directory layout
 * leaves room for future sibling files (e.g. per-step notes or
 * recorded fixtures) without forcing them on v1.
 *
 * Field order is {@link LIVE_WORKFLOW_FIELD_ORDER}; unknown keys
 * round-trip verbatim per Phase 0 invariant #4.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { LiveWorkflowSchema } from '../../schemas/live';
import type { LiveWorkflow } from '../../types/v5/live';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { LIVE_WORKFLOW_FIELD_ORDER } from './ordering';

export interface LiveWorkflowCodecContext {
  /** Workspace-relative folder path, e.g. "live-workflows/auth-a1b2c3d4". */
  path: string;
}

export function parseLiveWorkflow(yaml: string, context: LiveWorkflowCodecContext): ParsedDocument<LiveWorkflow> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path };
  const value = v.parse(LiveWorkflowSchema, merged);
  return makeParsed(value, doc);
}

export function serializeLiveWorkflow(write: WriteableDocument<LiveWorkflow>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, LIVE_WORKFLOW_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, LIVE_WORKFLOW_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
