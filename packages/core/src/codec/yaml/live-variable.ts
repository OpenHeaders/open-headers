/**
 * Live Variable codec (`variable.yaml`).
 *
 * A live variable persists as a single file under
 * `live-variables/<slug>-<uid>/variable.yaml`. The LV is a thin
 * namespace binding — all extraction lives on its backing workflow's
 * step captures, so the manifest only carries the binding identifiers
 * + UX state.
 *
 * Field order is {@link LIVE_VARIABLE_FIELD_ORDER}; unknown keys
 * round-trip verbatim per Phase 0 invariant #4.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { LiveVariableSchema } from '../../schemas/live';
import type { LiveVariable } from '../../types/v5/live';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { LIVE_VARIABLE_FIELD_ORDER } from './ordering';

export interface LiveVariableCodecContext {
  /** Workspace-relative folder path, e.g. "live-variables/auth-token-a1b2c3d4". */
  path: string;
}

export function parseLiveVariable(yaml: string, context: LiveVariableCodecContext): ParsedDocument<LiveVariable> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path };
  const value = v.parse(LiveVariableSchema, merged);
  return makeParsed(value, doc);
}

export function serializeLiveVariable(write: WriteableDocument<LiveVariable>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, LIVE_VARIABLE_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, LIVE_VARIABLE_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
