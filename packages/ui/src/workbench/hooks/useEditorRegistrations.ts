/**
 * useEditorRegistrations — the imperative glue every mounted editor gets
 * when `renderTabBody` mounts it: dirty reporting, save / save-as-template
 * registration, per-family duplicate-snapshot refs, and the edit-mode
 * "saved" label refresh. Plus the tab-bar's "Duplicate Tab" handler,
 * which reads the anchor tab's registered snapshot ref.
 *
 * The three registry maps (save-as-template, rule / request duplicate)
 * are owned here — set by the register callbacks, read by
 * `handleDuplicateTab`. `dirtyMap` / `saveRefMap` stay owned by
 * `useEditorGroups` (pruned on tab close / replace there, read by the
 * save shortcut and tab-lifecycle layer), so they flow in as refs.
 */

import type { MutableRefObject } from 'react';
import { useCallback, useRef } from 'react';
import type { Request, Rule } from '@openheaders/core/types';
import type { WorkbenchTab } from '../types';

interface UseEditorRegistrationsOptions {
  dirtyMap: MutableRefObject<Map<string, boolean>>;
  saveRefMap: MutableRefObject<Map<string, () => void>>;
  updateTab: (tabId: string, updates: Partial<WorkbenchTab>) => void;
  allTabs: WorkbenchTab[];
  rules: Rule[];
  openDuplicateRuleScratch: (content: Omit<Rule, 'uid' | 'path'>, opts?: { pinnedEnvId?: string | null }) => void;
  openDuplicateRequestScratch: (
    content: Omit<Request, 'uid' | 'path' | 'schemaVersion'>,
    opts?: { pinnedEnvId?: string | null },
  ) => void;
}

export interface EditorRegistrations {
  handleDirtyChange: (tabId: string, dirty: boolean) => void;
  handleSaved: (tabId: string, uid: string) => void;
  registerSaveRef: (tabId: string, saveFn: () => void) => void;
  registerSaveAsTemplateRef: (tabId: string, fn: () => void) => void;
  registerRuleDuplicateRef: (tabId: string, fn: () => Omit<Rule, 'uid' | 'path'> | null) => void;
  registerRequestDuplicateRef: (
    tabId: string,
    fn: () => Omit<Request, 'uid' | 'path' | 'schemaVersion'> | null,
  ) => void;
  handleDuplicateTab: (tabId: string) => void;
}

export function useEditorRegistrations({
  dirtyMap,
  saveRefMap,
  updateTab,
  allTabs,
  rules,
  openDuplicateRuleScratch,
  openDuplicateRequestScratch,
}: UseEditorRegistrationsOptions): EditorRegistrations {
  // ── Dirty tracking / save refs ─────────────────────────────────
  const handleDirtyChange = useCallback(
    (tabId: string, dirty: boolean) => {
      dirtyMap.current.set(tabId, dirty);
      updateTab(tabId, { dirty });
    },
    [dirtyMap, updateTab],
  );

  const registerSaveRef = useCallback(
    (tabId: string, saveFn: () => void) => {
      saveRefMap.current.set(tabId, saveFn);
    },
    [saveRefMap],
  );

  const saveAsTemplateRefMap = useRef<Map<string, () => void>>(new Map());
  const registerSaveAsTemplateRef = useCallback((tabId: string, fn: () => void) => {
    saveAsTemplateRefMap.current.set(tabId, fn);
  }, []);

  // ── Duplicate snapshot refs ────────────────────────────────────
  // Each mounted rule/request editor publishes a fn that projects its
  // live form into content-only domain data. "Duplicate Tab" reads the
  // anchor tab's snapshot and opens a fresh scratch seeded with it.
  // Tabs stay mounted (display:none) so a background tab's snapshot is
  // readable without switching to it first.
  const ruleDuplicateRefMap = useRef<Map<string, () => Omit<Rule, 'uid' | 'path'> | null>>(new Map());
  const registerRuleDuplicateRef = useCallback((tabId: string, fn: () => Omit<Rule, 'uid' | 'path'> | null) => {
    ruleDuplicateRefMap.current.set(tabId, fn);
  }, []);
  const requestDuplicateRefMap = useRef<Map<string, () => Omit<Request, 'uid' | 'path' | 'schemaVersion'> | null>>(
    new Map(),
  );
  const registerRequestDuplicateRef = useCallback(
    (tabId: string, fn: () => Omit<Request, 'uid' | 'path' | 'schemaVersion'> | null) => {
      requestDuplicateRefMap.current.set(tabId, fn);
    },
    [],
  );

  const handleDuplicateTab = useCallback(
    (tabId: string) => {
      const tab = allTabs.find((t) => t.id === tabId);
      if (!tab) return;
      if (tab.mode === 'edit' || tab.mode === 'rule-create') {
        const content = ruleDuplicateRefMap.current.get(tabId)?.();
        if (content) openDuplicateRuleScratch(content, { pinnedEnvId: tab.pinnedEnvId });
        return;
      }
      if (tab.mode === 'request-edit' || tab.mode === 'request-create') {
        const content = requestDuplicateRefMap.current.get(tabId)?.();
        if (content) openDuplicateRequestScratch(content, { pinnedEnvId: tab.pinnedEnvId });
      }
    },
    [allTabs, openDuplicateRuleScratch, openDuplicateRequestScratch],
  );

  // ── Handle rule saved (edit mode) ─────────────────────────────
  const handleSaved = useCallback(
    (tabId: string, uid: string) => {
      const rule = rules.find((r) => r.uid === uid);
      updateTab(tabId, { label: rule?.name ?? undefined, dirty: false });
    },
    [rules, updateTab],
  );

  return {
    handleDirtyChange,
    handleSaved,
    registerSaveRef,
    registerSaveAsTemplateRef,
    registerRuleDuplicateRef,
    registerRequestDuplicateRef,
    handleDuplicateTab,
  };
}
