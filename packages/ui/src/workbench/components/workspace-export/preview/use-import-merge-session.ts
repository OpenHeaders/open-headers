/**
 * Merge-editor data plane for the import preview (Phase 7.3.3a/7.3.5)
 * — the per-codec YAML deserializer, the bundle-wide commit that runs
 * the merged envelope through `importWorkspace`, and the `MergeFile`
 * projection of the preview diff. State stays component-owned in
 * `ImportPreviewModal`; setters arrive as inputs.
 */

import { hostBridge } from '@openheaders/core/bridge';
import {
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseLiveVariable,
  parseLiveWorkflow,
  parseRequest,
  parseRule,
  parseTemplate,
  parseVault,
  parseWorkspaceVariables,
} from '@openheaders/core/codec/yaml';
import {
  type SerializableEntityKind,
  type StrategyMap,
  serializeEntityYaml,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import type { MergeApplyOutcome, MergeFile } from '@openheaders/ui/shared/merge-editor';
import { useCallback } from 'react';
import { applyMergeResultsToEnvelope, diffResultToImportBundle } from './diff-to-import-bundle';
import type { ImportTargetSelection } from './TargetControl';
import type { PreviewState } from './types';

interface UseImportMergeSessionArgs {
  effectiveEnvelope: WorkspaceExport | null;
  preview: PreviewState | null;
  sourceHash: string | null;
  target: ImportTargetSelection;
  backupRestore: boolean;
  trustExport: boolean;
  stripScripts: boolean;
  omitOAuthConfigs: boolean;
  keepTargetCollectionOrder: boolean;
  refuseUidCollision: boolean;
  /** Per-uid YAML snapshots from the most recent import into the
   *  resolved target — promotes collisions to honest 3-pane. */
  lastImportedSnapshots: Record<string, string>;
  setPreview: (next: PreviewState) => void;
  setStaleSnapshotHash: (next: string | null) => void;
  /** Close the merge modal (success path — parent shows the toast). */
  closeMergeModal: () => void;
  onImported: (result: { targetWorkspaceId: string; importedCount: number; sourceLabel: string }) => void;
}

export interface ImportMergeSession {
  handleMergeApply: (filesArg: readonly MergeFile[], results: Map<string, string>) => Promise<MergeApplyOutcome[]>;
  /** Project the preview's typed diff into `MergeFile`s — add rows for
   *  new entities, modify rows (3-pane when a prior-import snapshot
   *  exists) for collisions. Rebuilt per render like the inline
   *  original so snapshot / diff updates flow through. */
  buildMergeFiles: () => MergeFile[];
}

export function useImportMergeSession({
  effectiveEnvelope,
  preview,
  sourceHash,
  target,
  backupRestore,
  trustExport,
  stripScripts,
  omitOAuthConfigs,
  keepTargetCollectionOrder,
  refuseUidCollision,
  lastImportedSnapshots,
  setPreview,
  setStaleSnapshotHash,
  closeMergeModal,
  onImported,
}: UseImportMergeSessionArgs): ImportMergeSession {
  // Per-codec parser dispatcher. Each non-singleton codec needs the
  // entity's `path` from the envelope; we look it up by uid across the
  // typed buckets. Throws on unknown uid / unknown entityType so the
  // merge editor surfaces the broken row inline.
  const deserializeMergeFile = useCallback(
    (text: string, file: MergeFile): unknown => {
      if (!effectiveEnvelope) throw new Error('No envelope available for path lookup.');
      const ent = effectiveEnvelope.entities;
      const findPath = (uid: string): string => {
        const lists: ReadonlyArray<{ uid: string; path?: string }>[] = [
          ent.collections,
          ent.folders,
          ent.rules,
          ent.requests,
          ent.templates,
          ent.environments,
          ent.liveWorkflows,
          ent.liveVariables,
        ];
        for (const list of lists) {
          const found = list.find((e) => e.uid === uid);
          if (found?.path) return found.path;
        }
        throw new Error(`Could not resolve path for uid ${uid}`);
      };
      switch (file.group) {
        case 'rule':
          return parseRule(text, { path: findPath(file.id) }).value;
        case 'request':
          return parseRequest(text, { path: findPath(file.id) }).value;
        case 'template':
          return parseTemplate(text, { path: findPath(file.id) }).value;
        case 'collection':
          return parseCollection(text, { path: findPath(file.id) }).value;
        case 'folder':
          return parseFolder(text, { path: findPath(file.id) }).value;
        case 'environment':
          return parseEnvironment({ default: text }).value;
        case 'liveWorkflow':
          return parseLiveWorkflow(text, { path: findPath(file.id) }).value;
        case 'liveVariable':
          return parseLiveVariable(text, { path: findPath(file.id) }).value;
        case 'workspaceVars':
          return parseWorkspaceVariables(text).value;
        case 'vault':
          return parseVault(text).value;
        default:
          throw new Error(`Unknown merge entity type: ${String(file.group)}`);
      }
    },
    [effectiveEnvelope],
  );

  // Bundle-wide commit through the merge editor: derive a fresh
  // envelope + StrategyMap from per-file results, re-run the SW
  // preview to detect concurrent edits, then submit through
  // `importWorkspace`. The merged envelope carries the user's resolved
  // entities instead of relying on a strategy map alone.
  const handleMergeApply = useCallback(
    async (filesArg: readonly MergeFile[], results: Map<string, string>): Promise<MergeApplyOutcome[]> => {
      const failAll = (err: string): MergeApplyOutcome[] =>
        filesArg.map((f) => ({ fileId: f.id, ok: false, status: 'resolved' as const, error: err }));
      if (!effectiveEnvelope || !preview || !sourceHash) return failAll('Preview is not ready.');
      let mergedEnvelope: WorkspaceExport;
      let derivedStrategies: StrategyMap;
      try {
        const out = applyMergeResultsToEnvelope({
          envelope: effectiveEnvelope,
          files: filesArg,
          results,
          diff: preview.diff,
          deserialize: deserializeMergeFile,
        });
        mergedEnvelope = out.envelope;
        derivedStrategies = out.strategies;
      } catch (err) {
        return failAll(err instanceof Error ? err.message : String(err));
      }
      try {
        const fresh = await hostBridge.call('previewWorkspaceImport', {
          incoming: mergedEnvelope,
          target,
          backupRestore,
        });
        if (!fresh.success || !fresh.snapshotHash) return failAll(fresh.error ?? 'Preview re-check failed');
        if (fresh.snapshotHash !== preview.snapshotHash) {
          setStaleSnapshotHash(preview.snapshotHash);
          if (fresh.diff && fresh.missingDeps) {
            setPreview({
              diff: fresh.diff,
              missingDeps: fresh.missingDeps,
              snapshotHash: fresh.snapshotHash,
              targetWorkspaceId: fresh.targetWorkspaceId ?? null,
            });
          }
          return failAll('Workspace changed since preview opened. Re-confirm in the legacy preview and retry.');
        }
        const res = await hostBridge.call('importWorkspace', {
          incoming: mergedEnvelope,
          strategies: derivedStrategies,
          backupRestore,
          trustExport,
          stripScripts,
          omitOAuthConfigs,
          keepTargetCollectionOrder,
          refuseUidCollision,
          target,
          sourceHash,
        });
        if (!res.success || !res.report || !res.targetWorkspaceId) {
          return failAll(res.error ?? 'Import failed');
        }
        // Success — close the merge modal and notify the parent.
        closeMergeModal();
        onImported({
          targetWorkspaceId: res.targetWorkspaceId,
          importedCount: res.report.summary.imported,
          sourceLabel: mergedEnvelope.source.workspaceLabel ?? mergedEnvelope.workspace.name,
        });
        return filesArg.map((f) => ({ fileId: f.id, ok: true, status: 'resolved' as const }));
      } catch (err) {
        return failAll(err instanceof Error ? err.message : String(err));
      }
    },
    [
      effectiveEnvelope,
      preview,
      sourceHash,
      target,
      backupRestore,
      trustExport,
      stripScripts,
      omitOAuthConfigs,
      keepTargetCollectionOrder,
      refuseUidCollision,
      onImported,
      deserializeMergeFile,
      setPreview,
      setStaleSnapshotHash,
      closeMergeModal,
    ],
  );

  const buildMergeFiles = useCallback((): MergeFile[] => {
    if (!preview) return [];
    // Project the preview's typed diff into the generic
    // bundle/workspace shape, then hand-roll the files so the caller's
    // session runs the bundle-wide commit through `importWorkspace`
    // rather than the per-file `applyEntity` shape
    // `buildImportMergeSession` defaults to.
    const { bundle, workspace } = diffResultToImportBundle(preview.diff, effectiveEnvelope ?? undefined);
    return bundle.entities.map((incoming) => {
      const existing = workspace.findByPathOrUid(incoming);
      const incomingYaml = serializeEntityYaml(incoming.entityType as SerializableEntityKind, incoming.entity);
      if (existing === undefined) {
        return {
          id: incoming.uid,
          label: incoming.path,
          language: 'yaml',
          group: incoming.entityType,
          kind: 'add' as const,
          theirs: incomingYaml,
          mine: '',
          initialResult: incomingYaml,
          badges: [{ label: 'added by import', tone: 'success' as const }],
        };
      }
      const existingYaml = serializeEntityYaml(incoming.entityType as SerializableEntityKind, existing);
      // 3-pane when we have a snapshot from a prior import —
      // the snapshot is what we last brought in, so it's the
      // honest common ancestor between `theirs` (new incoming)
      // and `mine` (local evolution since then).
      const snapshot = lastImportedSnapshots[incoming.uid];
      return {
        id: incoming.uid,
        label: incoming.path,
        language: 'yaml',
        group: incoming.entityType,
        kind: 'modify' as const,
        base: snapshot,
        theirs: incomingYaml,
        mine: existingYaml,
        initialResult: existingYaml,
        badges: [{ label: 'collision', tone: 'warn' as const }],
      };
    });
  }, [preview, effectiveEnvelope, lastImportedSnapshots]);

  return { handleMergeApply, buildMergeFiles };
}
