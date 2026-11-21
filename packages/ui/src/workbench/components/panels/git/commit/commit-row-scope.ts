/**
 * commit-row-scope — what the Commit tree hands every row it draws
 * (`CommitPathRow`, `CommitNamedRow`): the looks the rows share, the
 * lookups a row reads its own state from, and the gestures it hands
 * back. A row keeps nothing of its own: it is mounted while it is in
 * view and drawn from this and its row of the model.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import type { ChangeGroupKey, CheckAggregate } from './commit-model';
import type { VcsPalette } from './vcs-colors';

/** A git group as its header reads. */
export interface CommitGroupFace {
  label: string;
  /** Its rows carry checkboxes — never the ignored group's. */
  checkable: boolean;
  /** "6 files", or "1 directory and 6 files" where the group draws directory rows. */
  countText: string;
}

export interface CommitRowScope {
  t: Translate;
  textColor: string;
  dimColor: string;
  palette: VcsPalette;
  /** The binding's folder name — a root-level file's dim suffix and the content-root node's label. */
  rootLabel: string;
  /** The file whose working diff is being read — its row says so at its end. */
  loadingPath: string | null;
  rowsByPath: ReadonlyMap<string, WorkspaceTreeWorkingChangeWire>;
  groupFace: (group: ChangeGroupKey) => CommitGroupFace;
  filesCountText: (count: number) => string;
  isSelected: (key: string) => boolean;
  isChecked: (row: WorkspaceTreeWorkingChangeWire) => boolean;
  /** The tri-state of a row that holds others, by its key. */
  aggregateOf: (key: string) => CheckAggregate;
  /** The files under a row that holds others, by its key — its checkbox's set. */
  pathsOf: (key: string) => readonly string[];
  onSetChecked: (paths: readonly string[], checked: boolean) => void;
  onToggleFold: (key: string) => void;
  onRowClick: (key: string, event: React.MouseEvent) => void;
  onOpenFile: (path: string) => void;
  /** The pointer entered a file's row listed by path — the tree shows the row whole where it is clipped. */
  onRowEnter: (element: HTMLElement, key: string, row: WorkspaceTreeWorkingChangeWire, suffix: string) => void;
  onRowLeave: (key: string) => void;
}
