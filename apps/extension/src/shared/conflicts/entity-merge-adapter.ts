/**
 * Entity-conflict adapter — projects a per-entity conflict surface
 * into a generic `MergeSession`.
 *
 * Phase 1 scope: text-shape adapter only. Caller hands us the
 * serialized canonical (theirs), the form's projected YAML (mine),
 * an optional baseline projection serialized as YAML (base), and an
 * onApply callback that takes the user's final result text.
 *
 * The resolution-table coexistence (per-path picks composed with the
 * editable result) wires up at Phase 6 alongside the
 * `<EntityConflictDialog>` replacement; that wiring needs the
 * state-machine spec's pick-region rules implemented in the renderer
 * surface (Phase 2 — hunk arrows + table picks).
 */

import type { MergeApplyOutcome, MergeSession } from '../merge-editor';

export interface BuildEntityMergeSessionArgs {
  /** Stable id for the file row (entity uid is the natural choice). */
  fileId: string;
  /** Human-readable label rendered in the file row + sidebar. */
  label: string;
  /** Modal title — typically "Resolve external changes — <Entity>". */
  title: string;
  /** Optional language id; defaults to 'yaml'. */
  language?: 'yaml' | 'json' | 'plaintext' | string;
  /** Saved/incoming canonical YAML. */
  theirsText: string;
  /** Local form's projected YAML. */
  mineText: string;
  /** Optional baseline projection serialized as YAML. When omitted the
   *  modal renders the 2-pane fallback honestly (no fabricated
   *  ancestor). Adapters that want a 3-pane render for an entity with
   *  no baseline must explicitly seed it (e.g. with `mine`) at the
   *  call site — the builder doesn't fabricate. */
  baseText?: string;
  /** Pre-seeded result text. Spec convention for entities: `mineText`
   *  (user's WIP is the baseline they refine). Caller passes
   *  explicitly so the seed choice stays auditable per plan §11.2. */
  initialResult: string;
  /** User clicked Complete Merge. The adapter owns parsing the result
   *  text back into an entity and persisting it via the entity's
   *  existing save path. Throw to surface a parse / persistence
   *  error; the modal renders the error inline and stays open. */
  onApply(resultText: string): Promise<void> | void;
  onCancel(): void;
}

export function buildEntityMergeSession(args: BuildEntityMergeSessionArgs): MergeSession {
  const {
    fileId,
    label,
    title,
    language = 'yaml',
    theirsText,
    mineText,
    baseText,
    initialResult,
    onApply,
    onCancel,
  } = args;

  return {
    title,
    files: [
      {
        id: fileId,
        label,
        language,
        base: baseText,
        theirs: theirsText,
        mine: mineText,
        initialResult,
        kind: 'modify',
      },
    ],
    onApply: async (filesArg, results) => {
      const file = filesArg[0];
      const finalText = results.get(file.id);
      if (finalText === undefined) {
        const outcome: MergeApplyOutcome = { fileId: file.id, ok: true, status: 'unresolved' };
        return [outcome];
      }
      try {
        await onApply(finalText);
        return [{ fileId: file.id, ok: true, status: 'resolved' }];
      } catch (err) {
        return [
          {
            fileId: file.id,
            ok: false,
            status: 'resolved',
            error: err instanceof Error ? err.message : String(err),
          },
        ];
      }
    },
    onCancel,
  };
}
