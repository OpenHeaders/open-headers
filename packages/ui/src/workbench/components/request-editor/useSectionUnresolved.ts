/**
 * Per-section `{{ref}}` resolvability for the request editor — the
 * core HTTP scan's groups (`collectRequestTemplateGroups`, the
 * executor's field list) through the shared per-group resolver hook,
 * mapped onto the editor's tabs. Each flag is `true` when at least one
 * `{{ref}}` in that tab's strings fails to resolve. `{{file.X}}` is a
 * real scope (resolves to the content hash via the file registry the
 * resolver is fed); a missing file flags as `unset-in-scope` like any
 * other scope, and `{{dynamic.X}}` flags only for unknown generators.
 * `hasUnresolvedRefs` is the OR aggregate the editor shell's lifecycle
 * flag reads — the same reading the sidebar's resolvability set gives,
 * since both walk the same scan.
 *
 * The input is the draft's save projection (`buildRequestUpdates`),
 * the projection the dirty fingerprint already reads — one walk per
 * keystroke.
 */

import { collectRequestTemplateGroups, type RequestTemplateSource } from '@openheaders/core/live';
import { useMemo } from 'react';
import { useUnresolvedTemplateGroups } from '../shared/unresolved-template-groups';

export interface SectionUnresolved {
  url: boolean;
  params: boolean;
  headers: boolean;
  auth: boolean;
  body: boolean;
  settings: boolean;
}

export function useSectionUnresolved(
  draftUpdates: RequestTemplateSource,
  draftCollectionId: string | undefined,
): { sectionUnresolved: SectionUnresolved; hasUnresolvedRefs: boolean } {
  const groups = useMemo(() => collectRequestTemplateGroups(draftUpdates), [draftUpdates]);
  const { unresolvedGroups, hasUnresolvedRefs } = useUnresolvedTemplateGroups(groups, draftCollectionId);
  const sectionUnresolved = useMemo<SectionUnresolved>(
    () => ({
      url: unresolvedGroups.has('url'),
      params: unresolvedGroups.has('params'),
      headers: unresolvedGroups.has('headers'),
      auth: unresolvedGroups.has('auth'),
      body: unresolvedGroups.has('body'),
      settings: unresolvedGroups.has('settings'),
    }),
    [unresolvedGroups],
  );
  return { sectionUnresolved, hasUnresolvedRefs };
}
