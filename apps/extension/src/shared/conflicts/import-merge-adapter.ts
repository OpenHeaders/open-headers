/**
 * Import-bundle adapter — projects an incoming workspace export into a
 * generic `MergeSession` whose files render in the merge-editor shell's
 * multi-file mode (sidebar grouped by entity type, per-row badges,
 * per-row apply outcomes).
 *
 * Pure data; no UI imports. The adapter keeps three import semantics
 * honest in the resulting `MergeFile[]`:
 *   1. **Pure add** — entity not present locally. `kind: 'add'`,
 *      `base: undefined` (no ancestor), `mine: ''`, `initialResult`
 *      seeded with the incoming YAML so the user can edit before
 *      accepting or empty the buffer to skip.
 *   2. **Collision with prior-import snapshot** — real 3-way merge.
 *      `base` is the snapshot text the prior import wrote in,
 *      `theirs` is the new incoming, `mine` is what the user evolved
 *      locally since then.
 *   3. **Collision without snapshot** — 2-way fallback. `base` left
 *      undefined; the renderer collapses the centre column. We don't
 *      alias `base` to `mine` (that would be 2-way information
 *      wearing 3-pane theatre).
 *
 * Apply semantics:
 *   - `'add'` + empty result → `applyEntity('skip', null)`.
 *   - `'add'` + non-empty → `applyEntity('create', deserialized)`.
 *   - `'modify'` + result → `applyEntity('update', deserialized)`.
 *   - File never touched (no entry in `results`) → reported as
 *     `unresolved`; the caller decides whether to default-skip or
 *     re-prompt.
 *
 * Deserialize / apply errors are coerced into `MergeApplyOutcome.error`
 * messages; the modal renders the error inline next to the file row
 * and stays open so the user can fix and retry.
 */

import type { MergeApplyOutcome, MergeFile, MergeSession } from '../merge-editor';

/** One entity inside an import bundle. `entity` is opaque payload —
 *  the adapter only hands it to the caller-supplied serializer. */
export interface ImportBundleEntity {
  uid: string;
  /** Domain bucket — the merge-editor sidebar groups files by this
   *  string (e.g. `'rules'`, `'requests'`, `'environments'`). Also
   *  routed back to `applyEntity` so the caller can dispatch per-type. */
  entityType: string;
  /** Human-readable path / label rendered in the file row. */
  path: string;
  /** Caller-typed entity payload. Opaque to the adapter. */
  entity: unknown;
}

export interface ImportBundle {
  entities: readonly ImportBundleEntity[];
}

export interface ImportWorkspaceSnapshot {
  /** Resolve the incoming entity against the local workspace by uid
   *  (preferred) or path (fallback). Returns the local entity payload
   *  when found, undefined for pure adds. */
  findByPathOrUid(incoming: ImportBundleEntity): unknown | undefined;
}

export type ImportApplyOp = 'create' | 'update' | 'skip';

export interface BuildImportMergeSessionArgs {
  bundle: ImportBundle;
  workspace: ImportWorkspaceSnapshot;
  /** Optional registry of last-imported snapshot YAML keyed by entity
   *  uid. When present for a collision, the adapter emits a 3-pane
   *  file with the snapshot as `base`. When absent, the file is
   *  2-pane (`base` undefined). */
  lastImportedSnapshots?: ReadonlyMap<string, string>;
  /** Project an entity to YAML for the diff panes. Routed by
   *  `entityType` so the caller dispatches the right codec. */
  serializeYaml(entityType: string, entity: unknown): string;
  /** Inverse of `serializeYaml`. Throw on parse failure; the adapter
   *  coerces the error into the file row's apply outcome. */
  deserializeYaml(entityType: string, text: string): unknown;
  /** Persist the user's resolution. Throw on persistence failure;
   *  same coercion path. */
  applyEntity(entityType: string, op: ImportApplyOp, entity: unknown): Promise<void> | void;
  onCancel(): void;
}

export function buildImportMergeSession(args: BuildImportMergeSessionArgs): MergeSession {
  const { bundle, workspace, lastImportedSnapshots, serializeYaml, deserializeYaml, applyEntity, onCancel } = args;
  const files: MergeFile[] = [];

  for (const incoming of bundle.entities) {
    const existing = workspace.findByPathOrUid(incoming);
    const incomingYaml = serializeYaml(incoming.entityType, incoming.entity);

    if (existing === undefined) {
      files.push({
        id: incoming.uid,
        label: incoming.path,
        language: 'yaml',
        group: incoming.entityType,
        kind: 'add',
        // No ancestor for a brand-new entity; render 2-pane.
        theirs: incomingYaml,
        mine: '',
        initialResult: incomingYaml,
        badges: [{ label: 'added by import', tone: 'success' }],
      });
      continue;
    }

    const existingYaml = serializeYaml(incoming.entityType, existing);
    const snapshot = lastImportedSnapshots?.get(incoming.uid);

    if (snapshot !== undefined) {
      files.push({
        id: incoming.uid,
        label: incoming.path,
        language: 'yaml',
        group: incoming.entityType,
        kind: 'modify',
        base: snapshot,
        theirs: incomingYaml,
        mine: existingYaml,
        initialResult: existingYaml,
        badges: [{ label: 'collision', tone: 'warn' }],
      });
    } else {
      files.push({
        id: incoming.uid,
        label: incoming.path,
        language: 'yaml',
        group: incoming.entityType,
        kind: 'modify',
        // No prior-import snapshot → no honest base; 2-pane fallback.
        theirs: incomingYaml,
        mine: existingYaml,
        initialResult: existingYaml,
        badges: [{ label: 'collision', tone: 'warn' }],
      });
    }
  }

  return {
    title: `Import — ${files.length} ${files.length === 1 ? 'item' : 'items'}`,
    files,
    onApply: async (filesArg, results) => {
      const outcomes: MergeApplyOutcome[] = [];
      for (const file of filesArg) {
        const finalText = results.get(file.id);
        if (finalText === undefined) {
          outcomes.push({ fileId: file.id, ok: true, status: 'unresolved' });
          continue;
        }
        const entityType = file.group ?? '';
        if (file.kind === 'add' && finalText.trim() === '') {
          try {
            await applyEntity(entityType, 'skip', null);
            outcomes.push({ fileId: file.id, ok: true, status: 'resolved' });
          } catch (err) {
            outcomes.push({
              fileId: file.id,
              ok: false,
              status: 'resolved',
              error: err instanceof Error ? err.message : String(err),
            });
          }
          continue;
        }
        try {
          const entity = deserializeYaml(entityType, finalText);
          const op: ImportApplyOp = file.kind === 'add' ? 'create' : 'update';
          await applyEntity(entityType, op, entity);
          outcomes.push({ fileId: file.id, ok: true, status: 'resolved' });
        } catch (err) {
          outcomes.push({
            fileId: file.id,
            ok: false,
            status: 'resolved',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return outcomes;
    },
    onCancel,
  };
}
