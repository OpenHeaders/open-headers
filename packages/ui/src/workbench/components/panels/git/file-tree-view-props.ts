/**
 * A changed-files tree's contract with its pane — the same whichever
 * way the rows are drawn — and the one status colour of a file's name.
 */

import type { MenuProps, theme } from 'antd';

/** Porcelain status letter → theme color, (added green,
 *  modified blue, deleted red, rename/copy amber). */
export function fileStatusColor(status: string, token: ReturnType<typeof theme.useToken>['token']): string {
  switch (status) {
    case 'A':
      return token.colorSuccessText;
    case 'D':
      return token.colorErrorText;
    case 'R':
    case 'C':
      return token.colorWarningText;
    default:
      return token.colorInfoText;
  }
}

export interface FileTreeViewProps {
  files: ReadonlyArray<{ path: string; status: string }>;
  /** Path currently fetching its diff (per-file spinner). */
  loadingPath: string | null;
  onOpenFile: (path: string) => void;
  /** Selection wiring (the log pane): click selects, double-click opens. */
  selectedPath?: string | null;
  /** The file the pane's verbs act on after a gesture — null when no file is selected. */
  onSelectFile?: (path: string | null) => void;
  /** Group By Workspace (details eye) — the files by what they belong to in the workbench. */
  groupByWorkspace?: boolean;
  /** Group By Directory (details eye) — off renders flat full paths. */
  groupByDirectory?: boolean;
  /** Legacy inline header (compare pane) — heading + expand/collapse. */
  showHeader?: boolean;
  /** Right-click menu per file row (the log pane); right-click also
   *  selects the row when selection is wired. Absent = no menu. */
  rowMenu?: (path: string) => MenuProps;
}
