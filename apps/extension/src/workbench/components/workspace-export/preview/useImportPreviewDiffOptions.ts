/**
 * Adapts the 7 individual `workspaceSharing.importPreviewDiff*`
 * settings into a single `DiffViewerOptions` object + setter, the
 * shape `RichDiffEditor` expects. One setting per knob keeps the
 * Settings shell clean (each row has its own label/description) but
 * the diff component wants the bundle, so we marshal here.
 */

import { useCallback, useMemo } from 'react';
import type { DiffViewerOptions } from '@/workbench/components/diff-viewer';
import { useSetting } from '@/workbench/settings';

export function useImportPreviewDiffOptions(): [DiffViewerOptions, (next: DiffViewerOptions) => void] {
  const [mode, setMode] = useSetting('workspaceSharing.importPreviewDiffViewer');
  const [whitespace, setWhitespace] = useSetting('workspaceSharing.importPreviewDiffWhitespace');
  const [collapseUnchanged, setCollapseUnchanged] = useSetting('workspaceSharing.importPreviewDiffCollapseUnchanged');
  const [showWhitespaces, setShowWhitespaces] = useSetting('workspaceSharing.importPreviewDiffShowWhitespaces');
  const [showLineNumbers, setShowLineNumbers] = useSetting('workspaceSharing.importPreviewDiffShowLineNumbers');
  const [showIndentGuides, setShowIndentGuides] = useSetting('workspaceSharing.importPreviewDiffShowIndentGuides');
  const [softWrap, setSoftWrap] = useSetting('workspaceSharing.importPreviewDiffSoftWrap');

  const options = useMemo<DiffViewerOptions>(
    () => ({
      mode,
      whitespace,
      collapseUnchanged,
      showWhitespaces,
      showLineNumbers,
      showIndentGuides,
      softWrap,
    }),
    [mode, whitespace, collapseUnchanged, showWhitespaces, showLineNumbers, showIndentGuides, softWrap],
  );

  const setOptions = useCallback(
    (next: DiffViewerOptions) => {
      if (next.mode !== mode) setMode(next.mode);
      if (next.whitespace !== whitespace) setWhitespace(next.whitespace);
      if (next.collapseUnchanged !== collapseUnchanged) setCollapseUnchanged(next.collapseUnchanged);
      if (next.showWhitespaces !== showWhitespaces) setShowWhitespaces(next.showWhitespaces);
      if (next.showLineNumbers !== showLineNumbers) setShowLineNumbers(next.showLineNumbers);
      if (next.showIndentGuides !== showIndentGuides) setShowIndentGuides(next.showIndentGuides);
      if (next.softWrap !== softWrap) setSoftWrap(next.softWrap);
    },
    [
      mode,
      whitespace,
      collapseUnchanged,
      showWhitespaces,
      showLineNumbers,
      showIndentGuides,
      softWrap,
      setMode,
      setWhitespace,
      setCollapseUnchanged,
      setShowWhitespaces,
      setShowLineNumbers,
      setShowIndentGuides,
      setSoftWrap,
    ],
  );

  return [options, setOptions];
}
