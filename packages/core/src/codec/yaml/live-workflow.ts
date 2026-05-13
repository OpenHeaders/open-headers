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
import type { LiveWorkflow } from '../../types/live';
import { generateUid } from '../../utils/workspace';
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
  mintMissingUids(merged);
  const value = v.parse(LiveWorkflowSchema, merged);
  return makeParsed(value, doc);
}

/**
 * Stamp `uid` on any step / capture / gate-clause that's missing one
 * before validation runs. Mirrors `variables.ts` and `environment.ts`
 * — defensive against hand-authored YAML or pre-uid exports
 * (`schemas/live.ts` made these uids required after the Phase A
 * schema-add-uid commit). Mutates the parsed object in place because
 * the YAML.Document round-trip happens against the original `doc`,
 * not the merged JS object — minted uids only persist if a downstream
 * write goes through `serializeLiveWorkflow` with the validated
 * value, which is the existing contract.
 */
function mintMissingUids(merged: Record<string, unknown>): void {
  const steps = merged.steps;
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (typeof step !== 'object' || step === null) continue;
    const s = step as Record<string, unknown>;
    if (typeof s.uid !== 'string') s.uid = generateUid();
    const captures = s.captures;
    if (Array.isArray(captures)) {
      for (const capture of captures) {
        if (typeof capture !== 'object' || capture === null) continue;
        const c = capture as Record<string, unknown>;
        if (typeof c.uid !== 'string') c.uid = generateUid();
      }
    }
    const runIf = s.runIf;
    if (runIf && typeof runIf === 'object') {
      const all = (runIf as Record<string, unknown>).all;
      if (Array.isArray(all)) {
        for (const clause of all) {
          if (typeof clause !== 'object' || clause === null) continue;
          const cl = clause as Record<string, unknown>;
          if (typeof cl.uid !== 'string') cl.uid = generateUid();
        }
      }
    }
  }
}

export function serializeLiveWorkflow(write: WriteableDocument<LiveWorkflow>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, LIVE_WORKFLOW_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, LIVE_WORKFLOW_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
