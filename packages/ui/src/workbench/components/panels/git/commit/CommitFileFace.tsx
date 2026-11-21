/**
 * CommitFileFace — a changed file as a row listed by path reads: the
 * type icon, the coloured filename, the rename note, the dim directory
 * suffix and an ignored row's source. `clip` is the form inside the
 * tree (the filename holds its width, the suffix takes the ellipsis);
 * off, the whole form the hover overlay shows over a clipped row.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { baseName } from './commit-tree-nav';
import { FileTypeIcon } from './FileTypeIcon';
import { ignoreSourceLabel } from './ignore-source-label';
import { type VcsPalette, vcsFileColor } from './vcs-colors';

/** The tree's text size — the UI font at 12px, never monospace. */
export const COMMIT_ROW_FONT = 12;

export interface CommitFileFaceProps {
  row: WorkspaceTreeWorkingChangeWire;
  suffix: string;
  clip: boolean;
  t: Translate;
  textColor: string;
  dimColor: string;
  palette: VcsPalette;
}

const CommitFileFace: React.FC<CommitFileFaceProps> = ({ row, suffix, clip, t, textColor, dimColor, palette }) => {
  const dim: React.CSSProperties = clip
    ? {
        flex: '0 1 auto',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: COMMIT_ROW_FONT,
        color: dimColor,
      }
    : { flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: COMMIT_ROW_FONT, color: dimColor };
  return (
    <>
      <FileTypeIcon path={row.path} status={row.status} symlink={row.symlink} />
      <span
        style={{
          flex: '0 0 auto',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: COMMIT_ROW_FONT,
          color: vcsFileColor(row, palette),
        }}
      >
        {baseName(row.path)}
      </span>
      {row.renamedFrom !== undefined && (
        <span
          style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: COMMIT_ROW_FONT, color: textColor }}
          data-testid="commit-tool-renamed-from"
        >
          {t('workbench.commitTool.renamedFrom', { name: baseName(row.renamedFrom) })}
        </span>
      )}
      {suffix.length > 0 && <span style={dim}>{suffix}</span>}
      {row.ignored && row.ignoreSource !== undefined && (
        <span style={dim} data-testid="commit-tool-ignore-source">
          {ignoreSourceLabel(t, row.ignoreSource)}
        </span>
      )}
    </>
  );
};

export default CommitFileFace;
