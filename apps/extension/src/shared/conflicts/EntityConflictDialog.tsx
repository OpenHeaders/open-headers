/**
 * Conflict-resolution dialog for an entity with unresolved external
 * changes. Thin shim over `<MergeConflictModal>`: caller supplies
 * the three text projections (saved / local / optional baseline) and
 * a commit callback that takes the user's final result text.
 *
 * The legacy path-keyed table + RichDiffEditor body retired in
 * Phase 6.11 once every entity editor wired `onResolveText`. Call-site
 * helpers that fed the table (`buildLocalText` / `pathLabels` /
 * `localValuesByPath`) and the picker-style `onResolve(map)` are gone
 * with it.
 */

import { useTheme } from '@context/ThemeContext';
import type React from 'react';
import { MergeConflictModal } from '@/shared/merge-editor';
import { buildEntityMergeSession } from './entity-merge-adapter';

export type ConflictResolution = 'theirs' | 'mine';

export interface EntityConflictDialogProps {
  open: boolean;
  /** Serialized canonical (saved version — "theirs" pane). */
  savedText: string;
  /** Serialized projection of the user's current local form / draft
   *  (the "mine" pane). The merge editor's result pane is seeded
   *  from this so the user starts from their work, not the saved
   *  copy. */
  mineText: string;
  /** Optional baseline (common ancestor — "base" pane). When supplied
   *  the modal renders 3-pane and exposes the Show Base layouts. */
  baseText?: string;
  /** Language id for syntax highlighting. Defaults to `yaml`. */
  language?: 'yaml' | 'json' | 'plaintext' | string;
  /** Commit seam — called with the user's final result text on
   *  Complete Merge. The caller owns parsing it back to an entity,
   *  adopting it into the form, and advancing the conflict tracker.
   *  Throw to surface a parse / persist error; the modal renders the
   *  message inline and stays open. */
  onResolveText: (resultText: string) => Promise<void> | void;
  onClose: () => void;
}

const EntityConflictDialog: React.FC<EntityConflictDialogProps> = ({
  open,
  savedText,
  mineText,
  baseText,
  language = 'yaml',
  onResolveText,
  onClose,
}) => {
  const { isDarkMode } = useTheme();
  if (!open) return null;
  return (
    <MergeConflictModal
      open
      isDarkMode={isDarkMode}
      surfaceId="entity-conflict"
      onClose={onClose}
      session={buildEntityMergeSession({
        fileId: 'entity',
        label: 'Resolve external changes',
        title: 'Resolve external changes',
        language,
        theirsText: savedText,
        mineText,
        baseText,
        initialResult: mineText,
        onApply: async (resultText: string) => {
          await onResolveText(resultText);
          onClose();
        },
        onCancel: onClose,
      })}
    />
  );
};

export default EntityConflictDialog;
