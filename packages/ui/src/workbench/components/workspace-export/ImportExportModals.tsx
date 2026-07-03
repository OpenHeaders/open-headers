import { hostBridge } from '@openheaders/core/bridge';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/readers/useWorkspaces';
import { App as AntApp } from 'antd';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import ImportCurlModal from '../import/ImportCurlModal';
import ImportHarModal from '../import/ImportHarModal';
import ImportPostmanModal from '../import/ImportPostmanModal';
import ExportModal, { type ExportModalScope } from './ExportModal';
import ImportPreviewModal, { type ImportPreviewSource } from './ImportPreviewModal';
import ImportSourceModal from './ImportSourceModal';

/**
 * Imperative surface the workbench shell drives from its various
 * "Import…" / "Export…" entry points (sidebar context menus, top-bar
 * menu, command-palette intents). The modal state and the modals
 * themselves live inside this component; callers only fire an opener.
 */
export interface ImportExportModalsHandle {
  openImportCurl: (ctx?: { collectionId?: string }) => void;
  openImportHar: (ctx?: { collectionId?: string }) => void;
  openImportPostman: () => void;
  openExportModal: (scope: ExportModalScope) => void;
  openImportSource: () => void;
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
  const workspacesApi = useWorkspaces();
  const editingScopeWorkspaceId = useWorkbenchEditingScopeWorkspaceId();
  const { message } = AntApp.useApp();

  const [importCurlOpen, setImportCurlOpen] = useState(false);
  const [importCurlContext, setImportCurlContext] = useState<{ collectionId?: string } | undefined>(undefined);
  const [importHarOpen, setImportHarOpen] = useState(false);
  const [importHarContext, setImportHarContext] = useState<{ collectionId?: string } | undefined>(undefined);
  const [importPostmanOpen, setImportPostmanOpen] = useState(false);
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
  const onImportFileChosen = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setImportPreviewState({ open: true, rawText: text, source: 'file' });
    } catch (err) {
      // File-read failures (sandbox quirks, perms) — surface inline. Modal
      // will display a parse-error banner if the bytes turn out to be
      // unreadable.
      setImportPreviewState({ open: true, rawText: '', source: 'file' });
      void err;
    }
  }, []);

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

  const openImportCurl = useCallback((ctx?: { collectionId?: string }) => {
    setImportCurlContext(ctx);
    setImportCurlOpen(true);
  }, []);
  const openImportHar = useCallback((ctx?: { collectionId?: string }) => {
    setImportHarContext(ctx);
    setImportHarOpen(true);
  }, []);
  const openImportPostman = useCallback(() => setImportPostmanOpen(true), []);
  const openExportModal = useCallback((scope: ExportModalScope) => setExportModalState({ open: true, scope }), []);
  // Click the menu entry / receive an `open-import-modal` intent →
  // show the drop-zone modal. The native picker is owned by the modal
  // itself; the bare `<input>` below is kept only for compatibility
  // with older direct-click sites that haven't migrated to the modal
  // yet (none currently — the menu now goes through the modal).
  const openImportSource = useCallback(() => setImportSourceModalOpen(true), []);

  useImperativeHandle(
    ref,
    () => ({ openImportCurl, openImportHar, openImportPostman, openExportModal, openImportSource }),
    [openImportCurl, openImportHar, openImportPostman, openExportModal, openImportSource],
  );

  return (
    <>
      <ImportCurlModal
        open={importCurlOpen}
        collections={requestsApi.collections}
        initialCollectionId={importCurlContext?.collectionId}
        onCancel={() => setImportCurlOpen(false)}
        createRequest={async ({ name, collectionUid, seed }) => {
          // The parser's output already carries every field the
          // editor would normally enter; pass the full seed so the
          // store builds the request with the imported shape.
          const created = await requestsApi.createRequest({ name, collectionUid, seed });
          return created ? { uid: created.uid } : null;
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
        onCancel={() => setImportHarOpen(false)}
        createRequest={async ({ name, collectionUid, seed }) => {
          const created = await requestsApi.createRequest({ name, collectionUid, seed });
          return created ? { uid: created.uid } : null;
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
        accept=".yaml,.yml,.json,application/yaml,application/json,text/yaml,text/plain"
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
        onFileChosen={(file) => {
          void onImportFileChosen(file);
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
