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
 *
 * Deferred until `isStatusLoaded` flips to true so the extension's local
 * collections are populated — otherwise openCreateTab falls back to
 * "create a new collection called 'My Rules'" on every reload.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { useEffect, useRef } from 'react';
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
}

export function useInitialHashRoute({
  isStatusLoaded,
  openCreateTab,
  openEditTab,
  openDocs,
  openRuleFlow,
  openRunReport,
  openSettings,
}: UseInitialHashRouteOptions): void {
  const hashProcessedRef = useRef(false);
  const openCreateTabRef = useRef(openCreateTab);
  const openEditTabRef = useRef(openEditTab);
  const openDocsRef = useRef(openDocs);
  const openRuleFlowRef = useRef(openRuleFlow);
  const openRunReportRef = useRef(openRunReport);
  const openSettingsRef = useRef(openSettings);
  openCreateTabRef.current = openCreateTab;
  openEditTabRef.current = openEditTab;
  openDocsRef.current = openDocs;
  openRuleFlowRef.current = openRuleFlow;
  openRunReportRef.current = openRunReport;
  openSettingsRef.current = openSettings;

  useEffect(() => {
    if (!isStatusLoaded || hashProcessedRef.current) return;
    hashProcessedRef.current = true;
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return;
    const parts = hash.split('/');
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
    } else if (parts[0] === 'docs' && parts[1]) {
      openDocsRef.current(parts[1]);
    } else if (parts[0] === 'flow') {
      const flowScope = parts[1] as RuleFlowScope;
      const flowUrl = parts.length > 2 ? parts.slice(2).join('/') : undefined;
      openRuleFlowRef.current(flowScope, undefined, undefined, flowUrl);
    } else if (parts[0] === 'settings') {
      if (parts[1] === 'category' && parts[2]) {
        openSettingsRef.current({ categoryId: parts[2] });
      } else if (parts[1]) {
        openSettingsRef.current({ settingKey: parts[1] });
      } else {
        openSettingsRef.current();
      }
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
