/**
 * The file rail, collapsed: dragging the rail's sash shut leaves this
 * narrow strip instead of nothing — one chip per file in the rail's own
 * order, wearing the file's glyph, a hairline between groups. The open
 * file wears the selection blue and any other chip answers the pointer,
 * as the rail's rows do (`merge-file-list.css`); a chip opens its file,
 * and its tooltip says what the row would: the name, the group, what is
 * left to answer.
 */

import { Tooltip, theme } from 'antd';
import { Fragment, type ReactElement } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { groupFiles } from '../file-groups';
import type { MergeFile } from '../types';
import { MergeFileGlyph, type MergeFileRowState, type RenderMergeFileIcon, STATUS_TAG } from './merge-file-glyph';
import './merge-file-list.css';

/** The strip's width in px — the modal reserves it beside the editors. */
export const MERGE_FILE_STRIP_WIDTH = 40;

export interface MergeFileStripProps {
  files: ReadonlyArray<MergeFile>;
  activeFileId: string;
  states?: ReadonlyMap<string, MergeFileRowState>;
  hunkCounts?: ReadonlyMap<string, number>;
  renderIcon?: RenderMergeFileIcon;
  onSelect(fileId: string): void;
}

const MergeFileStrip = ({
  files,
  activeFileId,
  states,
  hunkCounts,
  renderIcon,
  onSelect,
}: MergeFileStripProps): ReactElement => {
  const { token } = theme.useToken();
  const t = useT();

  const describe = (file: MergeFile): ReactElement => {
    const remaining = hunkCounts?.get(file.id) ?? 0;
    const status = states?.get(file.id)?.status ?? 'unresolved';
    return (
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 600 }}>{file.label}</div>
        {file.group ? <div style={{ opacity: 0.75 }}>{file.group}</div> : null}
        <div style={{ opacity: 0.75 }}>
          {remaining > 0
            ? t('shared.mergeEditor.fileList.hunksRemaining', { count: remaining })
            : t(STATUS_TAG[status].labelKey)}
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="merge-file-strip"
      style={{
        flex: `0 0 ${MERGE_FILE_STRIP_WIDTH}px`,
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'none',
        scrollbarWidth: 'none',
        background: token.colorFillTertiary,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 0',
      }}
    >
      {groupFiles(files).map(({ group, files: listed }, index) => (
        <Fragment key={group || '_'}>
          {index > 0 ? (
            <div style={{ flex: '0 0 1px', width: 20, margin: '4px 0', background: token.colorSplit }} />
          ) : null}
          {listed.map((file) => (
            <Tooltip key={file.id} title={describe(file)} placement="right">
              <button
                type="button"
                className="oh-merge__file-row"
                aria-current={file.id === activeFileId}
                aria-label={file.label}
                onClick={() => onSelect(file.id)}
                style={{
                  flex: '0 0 28px',
                  width: 28,
                  border: 'none',
                  borderRadius: 6,
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorText,
                }}
              >
                <MergeFileGlyph file={file} renderIcon={renderIcon} size={16} />
              </button>
            </Tooltip>
          ))}
        </Fragment>
      ))}
    </div>
  );
};

export default MergeFileStrip;
