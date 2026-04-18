/**
 * useInitialHashRoute — one-shot hash router for the workspace page.
 *
 * Supported routes:
 *   #/create/{type}                  → open a fresh create tab (optional templateKey)
 *   #/create/{type}/{tplKey}
 *   #/create/{type}/draft-{nonce}    → open a create tab pre-filled from a background-stashed RuleDraft
 *   #/edit/{uid}                     → open an edit tab for an existing rule
 *   #/docs/{sectionId}               → surface the Docs tool window
 *   #/flow/{scope}/{...url}          → open a rule-flow tab
 *   #/test/{runId}                   → open a persisted test run report
 *   #/settings                       → open the settings modal
 *   #/settings/{key}                 → open the settings modal focused on a key
 *   #/settings/category/{id}         → open the settings modal focused on a category
 *   #/workspaces                     → open the workspace manager tab
 *
 * Two-stage routing:
 *   1. Routes that don't need rules/collection data — `workspaces`,
 *      `settings`, `docs` — fire on mount, before the service worker
 *      wakes, so the tab paints without waiting on a cold SW RPC.
 *   2. Routes that resolve rule or test-run uids — `create`, `edit`,
 *      `flow`, `test` — defer until `isStatusLoaded` flips true so
 *      the lookup has live data.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { useEffect, useMemo, useRef } from 'react';
import type { RuleFlowScope } from '../types';

interface UseInitialHashRouteOptions {
  isStatusLoaded: boolean;
  openCreateTab: (
    type: string,
    context?: { collectionId: string; folderPath?: string },
    templateKey?: string,
    initialDraft?: V5.RuleDraft,
  ) => void;
  openEditTab: (uid: string) => void;
  openDocs: (sectionId: string) => void;
  openRuleFlow: (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => void;
  openRunReport: (
    runId: string,
    owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
    ownerName?: string,
  ) => void;
  openSettings: (target?: { settingKey?: string; categoryId?: string }) => void;
  openWorkspaceManager: () => void;
}

export function useInitialHashRoute({
  isStatusLoaded,
  openCreateTab,
  openEditTab,
  openDocs,
  openRuleFlow,
  openRunReport,
  openSettings,
  openWorkspaceManager,
}: UseInitialHashRouteOptions): void {
  const hashProcessedRef = useRef(false);
  const openCreateTabRef = useRef(openCreateTab);
  const openEditTabRef = useRef(openEditTab);
  const openDocsRef = useRef(openDocs);
  const openRuleFlowRef = useRef(openRuleFlow);
  const openRunReportRef = useRef(openRunReport);
  const openSettingsRef = useRef(openSettings);
  const openWorkspaceManagerRef = useRef(openWorkspaceManager);
  openCreateTabRef.current = openCreateTab;
  openEditTabRef.current = openEditTab;
  openDocsRef.current = openDocs;
  openRuleFlowRef.current = openRuleFlow;
  openRunReportRef.current = openRunReport;
  openSettingsRef.current = openSettings;
  openWorkspaceManagerRef.current = openWorkspaceManager;

  // Parse the hash once on mount so stage 1 (data-free routes) and
  // stage 2 (rules-dependent routes) see identical segments.
  const parts = useMemo(() => window.location.hash.replace(/^#\/?/, '').split('/'), []);

  // ── Stage 1: data-free routes fire immediately on mount ──────────
  //
  // `#/workspaces`, `#/settings`, `#/docs/...` don't need rules or
  // test-run data to paint their target tab. Processing them before
  // the service worker wakes eliminates the 1-2 second blank-screen
  // window on cold SW starts.
  useEffect(() => {
    if (hashProcessedRef.current) return;
    if (parts[0] === 'workspaces') {
      hashProcessedRef.current = true;
      openWorkspaceManagerRef.current();
    } else if (parts[0] === 'settings') {
      hashProcessedRef.current = true;
      if (parts[1] === 'category' && parts[2]) {
        openSettingsRef.current({ categoryId: parts[2] });
      } else if (parts[1]) {
        openSettingsRef.current({ settingKey: parts[1] });
      } else {
        openSettingsRef.current();
      }
    } else if (parts[0] === 'docs' && parts[1]) {
      hashProcessedRef.current = true;
      openDocsRef.current(parts[1]);
    }
  }, [parts]);

  // ── Stage 2: rules-dependent routes wait for status load ─────────
  useEffect(() => {
    if (!isStatusLoaded || hashProcessedRef.current) return;
    hashProcessedRef.current = true;
    if (parts.length === 0 || !parts[0]) return;
    if (parts[0] === 'create' && parts[1]) {
      const type = parts[1];
      const third = parts[2];
      // `draft-{nonce}` sigil lets the panel's rule-draft handoff
      // coexist with the existing `{templateKey}` shape on the same
      // URL segment. Template keys are lowercase alphanumerics; the
      // `draft-` prefix is an unambiguous marker, not a reserved
      // identifier that could collide with a real template.
      if (third?.startsWith('draft-')) {
        const nonce = third.slice('draft-'.length);
        call('takeRuleDraft', { nonce })
          .then((res) => {
            const draft = (res?.draft ?? null) as V5.RuleDraft | null;
            // Absent/expired draft still opens a bare create tab for
            // the requested type — the user gets an empty form, which
            // is a better failure mode than a blank screen with no
            // indication of what they just tried to do.
            openCreateTabRef.current(type, undefined, undefined, draft ?? undefined);
          })
          .catch(() => openCreateTabRef.current(type));
      } else {
        openCreateTabRef.current(type, undefined, third);
      }
    } else if (parts[0] === 'edit' && parts[1]) {
      openEditTabRef.current(parts[1]);
    } else if (parts[0] === 'flow') {
      const flowScope = parts[1] as RuleFlowScope;
      const flowUrl = parts.length > 2 ? parts.slice(2).join('/') : undefined;
      openRuleFlowRef.current(flowScope, undefined, undefined, flowUrl);
    } else if (parts[0] === 'test' && parts[1]) {
      // Recover the owner stamp from the persisted run so the bottom
      // panel's contextual Test Runs tab can resolve its bucket.
      const runId = parts[1];
      call('getTestRun', { runId })
        .then((data) => {
          const run = data?.run ?? null;
          const owner = run ? { type: run.ownerType, id: run.ownerId } : undefined;
          openRunReportRef.current(runId, owner, run?.ownerNameAtRun);
        })
        .catch(() => openRunReportRef.current(runId));
    }
  }, [isStatusLoaded]);
}
