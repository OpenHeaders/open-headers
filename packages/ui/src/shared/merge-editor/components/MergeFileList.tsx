/**
 * Phase 5 — multi-file shell sidebar.
 *
 * Plan §5.3: ~280px collapsible left rail with one row per file. Each
 * row carries its glyph (the caller's icon for the file, else the
 * add/modify/remove kind), a status pill, and any adapter-supplied
 * badges. Group headers (`MergeFile.group`) render a
 * small uppercase strip, in the order `file-groups.ts` lists them.
 *
 * The modal decides whether a session lists its files; the list
 * renders whatever it is handed, one file included.
 *
 * The rail sits one fill step off the surface under it — the modal's,
 * which the editors beside it leave for their own — so it reads as a
 * panel of its own in every theme; the open file is the one solid
 * selection blue the workbench's tree rows wear, and any other row
 * answers the pointer (`merge-file-list.css`). The neutral chips (the count, `unresolved`)
 * are a translucent fill too: an opaque one is the rail's own colour
 * and would show only on a hovered or open row.
 *
 * Status pill colors mirror the plan's vocabulary:
 *   unresolved  = neutral
 *   partial     = warning
 *   resolved    = success
 *   failed      = error  (after Apply outcome)
 */

import { CheckCircleFilled, SwapOutlined, WarningFilled } from '@ant-design/icons';
import { Tag, Tooltip, Typography, theme } from 'antd';
import type { ReactElement } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { groupFiles } from '../file-groups';
import type { MergeFile } from '../types';
import {
  KIND_ICONS,
  MergeFileGlyph,
  type MergeFileRowState,
  type RenderMergeFileIcon,
  STATUS_TAG,
} from './merge-file-glyph';
import './merge-file-list.css';

const { Text } = Typography;

export interface MergeFileListProps {
  files: ReadonlyArray<MergeFile>;
  activeFileId: string;
  /** Optional state per file id. Missing entries default to unresolved. */
  states?: ReadonlyMap<string, MergeFileRowState>;
  /** Optional remaining-hunk count per file. Missing entries omit the
   *  badge. Active file should reflect live stats; inactive files get
   *  the initial-state count from session-open. */
  hunkCounts?: ReadonlyMap<string, number>;
  /** The caller's icon per file, in place of the kind glyph. */
  renderIcon?: RenderMergeFileIcon;
  onSelect(fileId: string): void;
}

const MergeFileList = ({
  files,
  activeFileId,
  states,
  hunkCounts,
  renderIcon,
  onSelect,
}: MergeFileListProps): ReactElement => {
  const { token } = theme.useToken();
  const t = useT();

  const grouped = groupFiles(files);
  const chipStyle = { margin: 0, fontSize: 10, lineHeight: '16px' };
  const neutralChipStyle = { ...chipStyle, background: token.colorFillTertiary };
  const showGroupHeaders = grouped.some((g) => g.group !== '');

  // Paired-row resolution (plan §5.3 v1: visual pairing only,
  // independent resolution per row). A row is "paired" when both
  // sides of the pair exist in the same session.
  const fileIds = new Set(files.map((f) => f.id));
  const isPaired = (file: MergeFile): boolean => file.pairedWith !== undefined && fileIds.has(file.pairedWith);
  const partnerLabel = (file: MergeFile): string | undefined => {
    if (!file.pairedWith) return undefined;
    return files.find((f) => f.id === file.pairedWith)?.label;
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'none',
        background: token.colorFillTertiary,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 0',
      }}
    >
      {grouped.map(({ group, files: groupFiles }) => (
        <div key={group || '_'} style={{ marginBottom: 6 }}>
          {showGroupHeaders ? (
            <Text
              type="secondary"
              style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                padding: '4px 12px',
              }}
            >
              {group || t('shared.mergeEditor.groupOther')}
            </Text>
          ) : null}
          {groupFiles.map((f) => {
            const state = states?.get(f.id) ?? { status: 'unresolved' as const };
            const kind = KIND_ICONS[f.kind];
            const status = STATUS_TAG[state.status];
            const isActive = f.id === activeFileId;
            return (
              <button
                type="button"
                key={f.id}
                className="oh-merge__file-row"
                aria-current={isActive}
                onClick={() => onSelect(f.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  padding: '6px 12px 6px 15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: token.colorText,
                }}
              >
                <Tooltip title={t(kind.tooltipKey)}>
                  <MergeFileGlyph file={f} renderIcon={renderIcon} size={14} />
                </Tooltip>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={f.label}
                >
                  {f.label}
                </span>
                {isPaired(f) ? (
                  <Tooltip title={t('shared.mergeEditor.fileList.pairedWith', { label: partnerLabel(f) ?? f.pairedWith ?? '' })}>
                    <SwapOutlined style={{ color: token.colorTextSecondary, fontSize: 12 }} />
                  </Tooltip>
                ) : null}
                {state.status === 'failed' && state.error ? (
                  <Tooltip title={state.error}>
                    <WarningFilled style={{ color: token.colorError, fontSize: 12 }} />
                  </Tooltip>
                ) : null}
                {hunkCounts?.has(f.id) && (hunkCounts.get(f.id) ?? 0) > 0 ? (
                  <Tooltip title={t('shared.mergeEditor.fileList.hunksRemaining', { count: hunkCounts.get(f.id) ?? 0 })}>
                    <Tag style={neutralChipStyle}>{hunkCounts.get(f.id)}</Tag>
                  </Tooltip>
                ) : null}
                <Tag color={status.color} style={status.color === 'default' ? neutralChipStyle : chipStyle}>
                  {t(status.labelKey)}
                </Tag>
                {state.status === 'resolved' ? (
                  <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 12 }} />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MergeFileList;
