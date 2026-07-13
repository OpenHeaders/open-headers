import { hostBridge } from '@openheaders/core/bridge';
import {
  type BrunoFile,
  type DetectedImportSource,
  detectImportSource,
  isBrunoImportPath,
  stripBrunoRootPrefix,
} from '@openheaders/core/import';
import type { RuleSeed } from '@openheaders/core/utils';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/readers/useWorkspaces';
import { applyRuleCreate } from '@openheaders/ui/shared/sync/rule-write-client';
import { App as AntApp } from 'antd';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import ImportCurlModal from '../import/ImportCurlModal';
import ImportHarModal from '../import/ImportHarModal';
import ImportPostmanModal from '../import/ImportPostmanModal';
import ImportSectionedModal, { type SectionedPreset, type SectionedSourceKind } from '../import/ImportSectionedModal';
import MigrateToolModal from '../import/MigrateToolModal';
import ExportModal, { type ExportModalScope } from './ExportModal';
import ImportPreviewModal, { type ImportPreviewSource } from './ImportPreviewModal';
import ImportSourceModal from './ImportSourceModal';
import type { PickedFile } from './picked-files';

/**
 * Imperative surface the workbench shell drives from its various
 * "Import…" / "Export…" entry points (sidebar context menus, top-bar
 * menu, command-palette intents). The modal state and the modals
 * themselves live inside this component; callers only fire an opener.
 */
export interface ImportExportModalsHandle {
  openExportModal: (scope: ExportModalScope) => void;
  /** Opens the import hub — the single "Import…" entry point. Every
   *  format (curl/URL/HAR/Postman/workspace) is auto-detected there;
   *  a `collectionId` (context-menu "import into this collection")
   *  carries through to whichever flow the hub routes to. */
  openImportSource: (ctx?: { collectionId?: string }) => void;
  /** Routes already-captured text (e.g. a curl command pasted into the
   *  URL bar) straight to its stage-2 modal — the hub's detection +
   *  hand-off without the hub modal. Unrecognized text is a no-op;
   *  callers gate on `detectImportSource` before consuming the paste. */
  openImportText: (text: string, ctx?: { collectionId?: string }) => void;
  /** Opens the migration surface (desktop only — the ladder needs fs). */
  openMigrateTool: () => void;
}

interface ImportExportModalsProps {
  /**
   * Switch the surface to a workspace after an import lands there.
   * Mode-aware in the caller (per-tab vs global); fired only when the
   * imported entities target a different workspace than this tab.
   */
  onSwitchWorkspace: (targetId: string, opts?: { makeActive?: boolean }) => void;
  /** Open a freshly-imported request in an editor tab (cURL flow). */
  onOpenRequest: (uid: string, name: string, method?: string) => void;
  /**
   * Shell root that doubles as the workspace-export drop target — a
   * dropped `.openheaders.*` file opens the import preview modal.
   */
  dropTargetRef: React.RefObject<HTMLElement | null>;
}

/**
 * The workbench import/export "modal farm". Owns the open/close state for
 * every import (cURL, HAR, Postman, workspace-file) and export flow, the
 * multi-file import queue, and the shell-wide file drop target. Its data
 * (requests, environments, workspaces, editing scope) is read from
 * context so the shell only wires the two genuinely parent-owned
 * callbacks and the drop-target ref.
 */
const ImportExportModals = forwardRef<ImportExportModalsHandle, ImportExportModalsProps>(function ImportExportModals(
  { onSwitchWorkspace, onOpenRequest, dropTargetRef },
  ref,
) {
  const requestsApi = useRequests();
  const envApi = useEnvironments();
  const rulesApi = useRules();
  const workspacesApi = useWorkspaces();
  const editingScopeWorkspaceId = useWorkbenchEditingScopeWorkspaceId();
  const { message } = AntApp.useApp();

  const [importCurlOpen, setImportCurlOpen] = useState(false);
  const [importCurlContext, setImportCurlContext] = useState<
    { collectionId?: string; initialSource?: string } | undefined
  >(undefined);
  const [importHarOpen, setImportHarOpen] = useState(false);
  const [importHarContext, setImportHarContext] = useState<
    { collectionId?: string; initialText?: string } | undefined
  >(undefined);
  const [importPostmanOpen, setImportPostmanOpen] = useState(false);
  const [importPostmanInitialText, setImportPostmanInitialText] = useState<string | undefined>(undefined);
  const [importSectionedState, setImportSectionedState] = useState<
    | { open: false }
    | { open: true; kind: SectionedSourceKind; text: string }
    | { open: true; kind: 'bruno'; files: BrunoFile[] }
  >({ open: false });
  const [importSourceContext, setImportSourceContext] = useState<{ collectionId?: string } | undefined>(undefined);
  const [exportModalState, setExportModalState] = useState<{ open: false } | { open: true; scope: ExportModalScope }>({
    open: false,
  });
  const [importPreviewState, setImportPreviewState] = useState<
    | { open: false }
    | { open: true; rawText: string; initialError?: string; source: ImportPreviewSource }
    | { open: true; rawText: null; initialError: string; source: ImportPreviewSource }
  >({ open: false });
  /**
   * Multi-file import queue (design §5.5). When the user drops or
   * picks more than one workspace-export file, we open the preview
   * modal for the first file and stash the rest here. On modal close
   * (cancel or success) we shift the queue and open the next.
   */
  const [, setPendingImportFiles] = useState<File[]>([]);
  const advanceImportQueue = useCallback(() => {
    setPendingImportFiles((queue) => {
      if (queue.length === 0) {
        setImportPreviewState({ open: false });
        return queue;
      }
      const [next, ...rest] = queue;
      void next
        .text()
        .then((text) => setImportPreviewState({ open: true, rawText: text, source: 'file' }))
        .catch((err: Error) =>
          setImportPreviewState({
            open: true,
            rawText: null,
            initialError: `Couldn't read ${next.name}: ${err.message}`,
            source: 'file',
          }),
        );
      return rest;
    });
  }, []);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importSourceModalOpen, setImportSourceModalOpen] = useState(false);
  // Hand-off: when the preview modal becomes visible, the source modal
  // has done its job — close it so the preview stands alone. The brief
  // skeleton state inside the source modal covers the parse + SW
  // preview RPC window so the user sees one continuous loading
  // affordance instead of a 1 s frozen-button gap.
  useEffect(() => {
    if (!importSourceModalOpen) return;
    if (importPreviewState.open) setImportSourceModalOpen(false);
  }, [importSourceModalOpen, importPreviewState.open]);

  /**
   * Look up a prior import report by source hash (ARCHITECTURE §23).
   * Shared across every import modal so the re-import-diff panel
   * renders uniformly. Errors are swallowed to `null` — the diff is
   * a nice-to-have, not a blocker on the import flow.
   */
  const findPreviousImportReport = useCallback(async (sourceHash: string) => {
    try {
      const { report } = await hostBridge.call('findImportReportBySourceHash', { sourceHash });
      return report;
    } catch {
      return null;
    }
  }, []);

  // Workspace-export drag-and-drop. The whole shell is a drop target;
  // a `.openheaders.yaml` / `.json` file opens the import preview modal.
  // We cancel non-file drags so the browser doesn't navigate the tab.
  useEffect(() => {
    const root = dropTargetRef.current;
    if (!root) return;
    const isExportFile = (file: File): boolean => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith('.openheaders.yaml') || name.endsWith('.openheaders.yml') || name.endsWith('.openheaders.json')
      );
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types);
      if (types.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const dropped = Array.from(e.dataTransfer?.files ?? []).filter(isExportFile);
      if (dropped.length === 0) return;
      e.preventDefault();
      const [first, ...rest] = dropped;
      setPendingImportFiles(rest);
      void first
        .text()
        .then((text) => setImportPreviewState({ open: true, rawText: text, source: 'file' }))
        .catch((err: Error) =>
          setImportPreviewState({
            open: true,
            rawText: null,
            initialError: `Couldn't read ${first.name}: ${err.message}`,
            source: 'file',
          }),
        );
    };
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    return () => {
      root.removeEventListener('dragover', onDragOver);
      root.removeEventListener('drop', onDrop);
    };
  }, [dropTargetRef]);

  const openImportCurl = useCallback((ctx?: { collectionId?: string; initialSource?: string }) => {
    setImportCurlContext(ctx);
    setImportCurlOpen(true);
  }, []);
  const openImportHar = useCallback((ctx?: { collectionId?: string; initialText?: string }) => {
    setImportHarContext(ctx);
    setImportHarOpen(true);
  }, []);
  const openImportPostman = useCallback((initialText?: string) => {
    setImportPostmanInitialText(initialText);
    setImportPostmanOpen(true);
  }, []);
  const openExportModal = useCallback((scope: ExportModalScope) => setExportModalState({ open: true, scope }), []);
  // Click the menu entry / receive an `open-import-modal` intent →
  // show the import hub. The native picker is owned by the modal
  // itself; the bare `<input>` below is kept only for compatibility
  // with older direct-click sites that haven't migrated to the modal
  // yet (none currently — the menu now goes through the modal).
  const openImportSource = useCallback((ctx?: { collectionId?: string }) => {
    setImportSourceContext(ctx);
    setImportSourceModalOpen(true);
  }, []);

  // Migration surface (MIGRATION_STATUS.md S5 addendum) — desktop only:
  // the detect/scan/pull RPCs answer in the desktop shell dispatcher.
  const [migrateToolOpen, setMigrateToolOpen] = useState(false);
  const migrationAvailable = getCurrentHost() === 'desktop';
  const openMigrateTool = useCallback(() => {
    if (!migrationAvailable) return;
    setImportSourceModalOpen(false);
    setMigrateToolOpen(true);
  }, [migrationAvailable]);

  /**
   * Hub routing (IMPORT_PLAN.md §2.1): a recognized paste or file lands
   * in the matching stage-2 flow pre-filled, carrying the hub's
   * collection context. `unknown` never reaches here — the hub keeps it
   * inline with a hint.
   */
  const routeText = useCallback(
    (detected: DetectedImportSource, text: string, collectionId?: string) => {
      setImportSourceModalOpen(false);
      switch (detected.kind) {
        case 'curl':
          openImportCurl({ collectionId, initialSource: text });
          break;
        case 'url':
          openImportCurl({ collectionId, initialSource: `curl '${detected.url}'` });
          break;
        case 'har':
          openImportHar({ collectionId, initialText: text });
          break;
        case 'postman':
          openImportPostman(text);
          break;
        case 'postman-backup':
        case 'insomnia':
        case 'bruno':
          setImportSectionedState({ open: true, kind: detected.kind, text });
          break;
        case 'workspace':
          setImportPreviewState({ open: true, rawText: text, source: 'clipboard' });
          break;
        default:
          break;
      }
    },
    [openImportCurl, openImportHar, openImportPostman],
  );

  const routeDetectedText = useCallback(
    (detected: DetectedImportSource, text: string) => routeText(detected, text, importSourceContext?.collectionId),
    [routeText, importSourceContext],
  );

  const openImportText = useCallback(
    (text: string, ctx?: { collectionId?: string }) => {
      const detected = detectImportSource(text);
      if (detected.kind === 'unknown') return;
      routeText(detected, text, ctx?.collectionId);
    },
    [routeText],
  );

  /**
   * Materialize backup header presets as UNPUBLISHED header rules
   * (MIGRATION_STATUS.md S2 decision): one rule per preset, all-`add`
   * modifications, no conditions — the publication gate keeps them
   * inert until the user scopes and publishes them. They land in a
   * dedicated rule collection so the sidebar shows one obvious home.
   */
  const materializeHeaderPresets = useCallback(
    async (presets: SectionedPreset[]): Promise<number> => {
      if (presets.length === 0 || !editingScopeWorkspaceId) return 0;
      const targetName = 'Imported header presets';
      const collection =
        rulesApi.localCollections.find((c) => c.name === targetName) ??
        (await rulesApi.createLocalCollection(targetName));
      if (!collection) return 0;
      let created = 0;
      for (const preset of presets) {
        const seed: RuleSeed = {
          name: preset.name,
          type: 'header',
          enabled: true,
          conditions: [],
          action: {
            requestHeaders: preset.headers
              .filter((h) => h.enabled !== false)
              .map((h) => ({ uid: h.uid, operation: 'add' as const, headerName: h.key, value: h.value })),
            responseHeaders: [],
          },
        };
        const result = await applyRuleCreate(
          { rule: seed, parentPath: collection.path },
          { workspaceId: editingScopeWorkspaceId, surfaceId: 'workbench-import' },
        );
        if (result.ok) created += 1;
      }
      return created;
    },
    [rulesApi, editingScopeWorkspaceId],
  );

  const onImportFileChosen = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const detected = detectImportSource(text);
        if (detected.kind === 'workspace' || detected.kind === 'unknown') {
          // The workspace preview owns envelope validation, so unknown
          // content lands there too and surfaces its parse-error banner.
          setImportPreviewState({ open: true, rawText: text, source: 'file' });
          return;
        }
        routeDetectedText(detected, text);
      } catch (err) {
        // File-read failures (sandbox quirks, perms) — surface inline.
        setImportPreviewState({ open: true, rawText: '', source: 'file' });
        void err;
      }
    },
    [routeDetectedText],
  );

  /**
   * A picked/dropped folder is a Bruno collection candidate: strip the
   * folder's own name off the paths, keep only importable files
   * (`.bru` / `bruno.json` — nothing else is ever opened), read those,
   * and land in the sectioned modal. An empty result keeps the hub
   * open with a warning instead of dead-ending.
   */
  const onImportFolderChosen = useCallback(
    async (picked: PickedFile[]) => {
      const importable = stripBrunoRootPrefix(picked).filter((p) => isBrunoImportPath(p.path));
      if (importable.length === 0) {
        message.warning('No Bruno files in that folder — expected .bru files or a bruno.json.');
        return;
      }
      const files: BrunoFile[] = [];
      let unreadable = 0;
      for (const p of importable) {
        try {
          files.push({ path: p.path, content: await p.file.text() });
        } catch {
          unreadable += 1;
        }
      }
      if (unreadable > 0) {
        message.warning(`${unreadable} file${unreadable === 1 ? '' : 's'} could not be read and were skipped.`);
      }
      if (files.length === 0) return;
      setImportSourceModalOpen(false);
      setImportSectionedState({ open: true, kind: 'bruno', files });
    },
    [message],
  );

  useImperativeHandle(
    ref,
    () => ({ openExportModal, openImportSource, openImportText, openMigrateTool }),
    [openExportModal, openImportSource, openImportText, openMigrateTool],
  );

  return (
    <>
      <ImportCurlModal
        open={importCurlOpen}
        collections={requestsApi.collections}
        initialCollectionId={importCurlContext?.collectionId}
        initialSource={importCurlContext?.initialSource}
        onCancel={() => setImportCurlOpen(false)}
        createRequest={async ({ name, collectionUid, seed }) => {
          // The parser's output already carries every field the
          // editor would normally enter; pass the full seed so the
          // store builds the request with the imported shape.
          const created = await requestsApi.createRequest({ name, collectionUid, seed });
          return created ? { uid: created.uid } : null;
        }}
        createCollection={async (name) => {
          const c = await requestsApi.createCollection(name);
          return c ? { uid: c.uid } : null;
        }}
        findPreviousReport={findPreviousImportReport}
        onImported={({ requestUid, name, method, report }) => {
          setImportCurlOpen(false);
          // Open the freshly-imported request in an editor tab so
          // the user can immediately inspect or tweak it. Use the
          // caller-chosen name + method so the tab label + method
          // glyph match the new request on first paint (avoids a
          // "Imported request / GET" flash before the hook hydrates).
          onOpenRequest(requestUid, name, method);
          // Persist the structured import report (ARCHITECTURE §23).
          // Fire-and-forget — the request itself already landed; a
          // failure to persist the report is a nice-to-have loss,
          // not a hard error. Surfaces at triage time via the
          // observability log if it matters.
          void hostBridge.call('recordImportReport', { report }).catch(() => undefined);
        }}
      />

      <ImportHarModal
        open={importHarOpen}
        collections={requestsApi.collections}
        initialCollectionId={importHarContext?.collectionId}
        initialText={importHarContext?.initialText}
        onCancel={() => setImportHarOpen(false)}
        createRequest={async ({ name, collectionUid, seed }) => {
          const created = await requestsApi.createRequest({ name, collectionUid, seed });
          return created ? { uid: created.uid } : null;
        }}
        createCollection={async (name) => {
          const c = await requestsApi.createCollection(name);
          return c ? { uid: c.uid } : null;
        }}
        findPreviousReport={findPreviousImportReport}
        onImported={({ report }) => {
          setImportHarOpen(false);
          // HAR imports can produce many requests at once — we don't
          // auto-open an editor tab, to avoid flooding the tab bar.
          // The user browses the sidebar to find their new entries.
          // The structured report still lands in storage for audit.
          void hostBridge.call('recordImportReport', { report }).catch(() => undefined);
        }}
      />

      <ImportPostmanModal
        open={importPostmanOpen}
        initialText={importPostmanInitialText}
        onCancel={() => setImportPostmanOpen(false)}
        createCollection={async (name) => {
          const c = await requestsApi.createCollection(name);
          return c ? { uid: c.uid, path: c.path } : null;
        }}
        createFolder={async (name, parentPath) => {
          const f = await requestsApi.createFolder(name, parentPath);
          return f ? { uid: f.uid, path: f.path } : null;
        }}
        createRequest={async ({ name, parentPath, seed }) => {
          const r = await requestsApi.createRequest({ name, parentPath, seed });
          return r ? { uid: r.uid } : null;
        }}
        createEnvironment={async ({ name, variables }) => {
          const e = await envApi.createEnvironment(name, variables);
          return e ? { uid: e.uid } : null;
        }}
        findPreviousReport={findPreviousImportReport}
        onImported={({ report }) => {
          setImportPostmanOpen(false);
          // Postman imports are multi-entity — like HAR, we don't
          // auto-open an editor tab. The user navigates to the new
          // collection from the sidebar. Structured report still
          // lands in storage for audit.
          void hostBridge.call('recordImportReport', { report }).catch(() => undefined);
        }}
      />

      <ImportSectionedModal
        open={importSectionedState.open}
        sourceKind={importSectionedState.open ? importSectionedState.kind : 'postman-backup'}
        initialText={importSectionedState.open && 'text' in importSectionedState ? importSectionedState.text : undefined}
        initialFiles={
          importSectionedState.open && 'files' in importSectionedState ? importSectionedState.files : undefined
        }
        onCancel={() => setImportSectionedState({ open: false })}
        createCollection={async (name) => {
          const c = await requestsApi.createCollection(name);
          return c ? { uid: c.uid, path: c.path } : null;
        }}
        createFolder={async (name, parentPath) => {
          const f = await requestsApi.createFolder(name, parentPath);
          return f ? { uid: f.uid, path: f.path } : null;
        }}
        createRequest={async ({ name, parentPath, seed }) => {
          const r = await requestsApi.createRequest({ name, parentPath, seed });
          return r ? { uid: r.uid } : null;
        }}
        createEnvironment={async ({ name, variables }) => {
          const e = await envApi.createEnvironment(name, variables);
          return e ? { uid: e.uid } : null;
        }}
        createHeaderRules={materializeHeaderPresets}
        findPreviousReport={findPreviousImportReport}
        onImported={({ report }) => {
          setImportSectionedState({ open: false });
          // Multi-entity import — like HAR/Postman, no editor tab is
          // auto-opened; the sidebar shows the new collections. The
          // structured report lands in storage for audit.
          void hostBridge.call('recordImportReport', { report }).catch(() => undefined);
        }}
      />

      {exportModalState.open && workspacesApi.activeWorkspace ? (
        <ExportModal
          open
          workspaceId={workspacesApi.activeWorkspace.id}
          workspaceName={workspacesApi.activeWorkspace.name}
          scope={exportModalState.scope}
          onCancel={() => setExportModalState({ open: false })}
        />
      ) : null}

      <input
        ref={importFileInputRef}
        type="file"
        accept=".yaml,.yml,.json,.bru,application/yaml,application/json,text/yaml,text/plain"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const picked = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = '';
          if (picked.length === 0) return;
          const [first, ...rest] = picked;
          setPendingImportFiles(rest);
          void onImportFileChosen(first);
        }}
      />

      <ImportSourceModal
        open={importSourceModalOpen}
        // Skeleton is on while the preview modal is being prepared.
        // It flips off (with the modal closing) the moment the
        // preview modal goes `open: true` — see the effect just
        // above that watches `importPreviewState.open`.
        loading={importPreviewState.open}
        onCancel={() => setImportSourceModalOpen(false)}
        onTextDetected={routeDetectedText}
        onFileChosen={(file) => {
          void onImportFileChosen(file);
        }}
        onFolderChosen={(picked) => {
          void onImportFolderChosen(picked);
        }}
        onMigrate={migrationAvailable ? openMigrateTool : undefined}
      />

      <MigrateToolModal
        open={migrateToolOpen}
        onClose={() => setMigrateToolOpen(false)}
        onImportBackupText={(text) => {
          setMigrateToolOpen(false);
          setImportSectionedState({ open: true, kind: 'postman-backup', text });
        }}
        onOpenImportHub={() => {
          setMigrateToolOpen(false);
          openImportSource();
        }}
      />

      <ImportPreviewModal
        open={importPreviewState.open}
        rawText={importPreviewState.open ? importPreviewState.rawText : null}
        initialError={importPreviewState.open ? importPreviewState.initialError : undefined}
        source={importPreviewState.open ? importPreviewState.source : undefined}
        workspaces={workspacesApi.workspaces}
        activeWorkspaceId={editingScopeWorkspaceId}
        onCancel={() => advanceImportQueue()}
        onImported={({ targetWorkspaceId, importedCount, sourceLabel }) => {
          const summary = `Imported ${importedCount} entit${importedCount === 1 ? 'y' : 'ies'} from "${sourceLabel}"`;
          message.success(summary);
          advanceImportQueue();
          // If the target isn't the editing-scope workspace, offer
          // to switch — `onSwitchWorkspace` is mode-aware so the
          // jump lands per-tab in per-tab mode and globally otherwise.
          if (targetWorkspaceId !== editingScopeWorkspaceId) {
            void onSwitchWorkspace(targetWorkspaceId);
          }
        }}
      />
    </>
  );
});

export default ImportExportModals;
