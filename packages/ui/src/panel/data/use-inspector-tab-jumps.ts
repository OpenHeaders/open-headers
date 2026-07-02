/**
 * Row → inspector-tab jump handlers — traffic-list selection, cross-nav
 * from other tool windows, annotation-rail click-through, and
 * search-result jumps. Owns the search-highlight state those jumps set
 * (highlight / section / line / match index) and the sticky
 * last-viewed-section ref new tabs inherit.
 */

import { type MutableRefObject, useCallback, useRef, useState } from 'react';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { buildInspectorTab, type DetailSection } from './inspector-tab';
import type { UseInspectorEditorGroupsApi } from './use-inspector-editor-groups';
import type { PanelToolLayoutApi } from './use-panel-tool-layout';

function sectionToTab(section: string): DetailSection {
  if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
  if (section === 'Query Params' || section === 'Request Body') return 'payload';
  if (section === 'Response') return 'response';
  return 'headers';
}

export interface UseInspectorTabJumpsOptions {
  lookupByRequestId: ReadonlyMap<string, InspectorRowWithFires>;
  groups: UseInspectorEditorGroupsApi;
  tl: PanelToolLayoutApi;
}

export interface InspectorTabJumpsApi {
  lastSectionRef: MutableRefObject<DetailSection>;
  handleSelect: (requestId: string) => void;
  handleCrossNav: (requestId: string) => void;
  handleAnnotationJump: (requestId: string) => void;
  handleSearchResult: (
    requestId: string,
    highlight: string,
    section: string,
    lineNumber: number,
    matchIndex: number,
  ) => void;
  searchHighlight: string | undefined;
  searchSection: string | undefined;
  searchLineNumber: number | undefined;
  searchMatchIndex: number | undefined;
}

export function useInspectorTabJumps({
  lookupByRequestId,
  groups,
  tl,
}: UseInspectorTabJumpsOptions): InspectorTabJumpsApi {
  const lastSectionRef = useRef<DetailSection>('headers');
  const [searchHighlight, setSearchHighlight] = useState<string | undefined>(undefined);
  const [searchSection, setSearchSection] = useState<string | undefined>(undefined);
  const [searchLineNumber, setSearchLineNumber] = useState<number | undefined>(undefined);
  const [searchMatchIndex, setSearchMatchIndex] = useState<number | undefined>(undefined);
  const [, setSearchNonce] = useState(0);

  const handleSelect = useCallback(
    (requestId: string) => {
      const row = lookupByRequestId.get(requestId);
      if (!row) return;
      const tab = buildInspectorTab({ lifecycle: row.lifecycle, displayId: row.displayId }, 'network');
      tab.activeSection = lastSectionRef.current;
      groups.addTab(tab);
      setSearchHighlight(undefined);
      setSearchSection(undefined);
      setSearchLineNumber(undefined);
    },
    [lookupByRequestId, groups],
  );

  const handleCrossNav = useCallback(
    (requestId: string) => {
      tl.activateWindow('network');
      handleSelect(requestId);
    },
    [tl, handleSelect],
  );

  // Annotation-rail click-through: open the row's inspector tab on the
  // section the annotation targets (Headers, where the insight cards
  // render) — same mechanism as a search-result jump.
  const handleAnnotationJump = useCallback(
    (requestId: string) => {
      const row = lookupByRequestId.get(requestId);
      if (!row) return;
      const tab = buildInspectorTab({ lifecycle: row.lifecycle, displayId: row.displayId }, 'network');
      tab.activeSection = 'headers';
      groups.addTab(tab);
      groups.updateTab(tab.id, { activeSection: 'headers' });
    },
    [lookupByRequestId, groups],
  );

  const handleSearchResult = useCallback(
    (requestId: string, highlight: string, section: string, lineNumber: number, matchIndex: number) => {
      const row = lookupByRequestId.get(requestId);
      if (!row) return;
      const tab = buildInspectorTab({ lifecycle: row.lifecycle, displayId: row.displayId }, 'network');
      tab.activeSection = sectionToTab(section);
      groups.addTab(tab);
      groups.updateTab(tab.id, { activeSection: sectionToTab(section) });
      setSearchHighlight(highlight);
      setSearchSection(section);
      setSearchLineNumber(lineNumber);
      setSearchMatchIndex(matchIndex);
      setSearchNonce((n) => n + 1);
    },
    [lookupByRequestId, groups],
  );

  return {
    lastSectionRef,
    handleSelect,
    handleCrossNav,
    handleAnnotationJump,
    handleSearchResult,
    searchHighlight,
    searchSection,
    searchLineNumber,
    searchMatchIndex,
  };
}
