/**
 * Phase 5 — multi-file shell sidebar.
 *
 * Plan §5.3: ~280px collapsible left rail with one row per file. Each
 * row carries a kind icon (add/modify/remove), a status pill, and any
 * adapter-supplied badges. Group headers (`MergeFile.group`) sort
 * groups alphabetically and render a small uppercase strip.
 *
 * Hidden entirely when `files.length === 1` — single-file callers
 * never see the sidebar even if they pass an `initialFileId`.
 *
 * Status pill colors mirror the plan's vocabulary:
 *   unresolved  = neutral
 *   partial     = warning
 *   resolved    = success
 *   failed      = error  (after Apply outcome)
 */

import {
  CheckCircleFilled,
  MinusCircleOutlined,
  PlusCircleOutlined,
  SwapOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { Tag, Tooltip, Typography, theme } from 'antd';
import type { ReactElement } from 'react';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { MergeFile, MergeFileKind } from '../types';

const { Text } = Typography;

export type MergeFileStatus = 'unresolved' | 'partial' | 'resolved' | 'failed';

export interface MergeFileRowState {
  status: MergeFileStatus;
  /** Adapter-side error from Apply, when status === 'failed'. */
  error?: string;
}

export interface MergeFileListProps {
  files: ReadonlyArray<MergeFile>;
  activeFileId: string;
  /** Optional state per file id. Missing entries default to unresolved. */
  states?: ReadonlyMap<string, MergeFileRowState>;
  /** Optional remaining-hunk count per file. Missing entries omit the
   *  badge. Active file should reflect live stats; inactive files get
   *  the initial-state count from session-open. */
  hunkCounts?: ReadonlyMap<string, number>;
  onSelect(fileId: string): void;
}

const KIND_ICONS: Record<MergeFileKind, { icon: ReactElement; color: string; tooltipKey: MessageKey }> = {
  add: { icon: <PlusCircleOutlined />, color: '#52c41a', tooltipKey: 'shared.mergeEditor.fileList.kindAdded' },
  modify: {
    icon: <span style={{ fontWeight: 700 }}>·</span>,
    color: '#1677ff',
    tooltipKey: 'shared.mergeEditor.fileList.kindModified',
  },
  remove: { icon: <MinusCircleOutlined />, color: '#ff4d4f', tooltipKey: 'shared.mergeEditor.fileList.kindRemoved' },
};

const STATUS_TAG: Record<MergeFileStatus, { color: string; labelKey: MessageKey }> = {
  unresolved: { color: 'default', labelKey: 'shared.mergeEditor.fileList.statusUnresolved' },
  partial: { color: 'warning', labelKey: 'shared.mergeEditor.fileList.statusPartial' },
  resolved: { color: 'success', labelKey: 'shared.mergeEditor.fileList.statusResolved' },
  failed: { color: 'error', labelKey: 'shared.mergeEditor.fileList.statusFailed' },
};

interface GroupedFile {
  group: string;
  files: MergeFile[];
}

function groupFiles(files: ReadonlyArray<MergeFile>): GroupedFile[] {
  const map = new Map<string, MergeFile[]>();
  for (const f of files) {
    const key = f.group ?? '';
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push(f);
  }
  return Array.from(map.entries())
    .map(([group, files]) => ({ group, files }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

const MergeFileList = ({
  files,
  activeFileId,
  states,
  hunkCounts,
  onSelect,
}: MergeFileListProps): ReactElement | null => {
  const { token } = theme.useToken();
  const t = useT();

  if (files.length <= 1) return null;
  const grouped = groupFiles(files);
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
        width: 280,
        minWidth: 220,
        height: '100%',
        overflowY: 'auto', overscrollBehavior: 'none',
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
                onClick={() => onSelect(f.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: isActive ? token.colorFillSecondary : 'transparent',
                  border: 'none',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: token.colorText,
                  borderLeft: `3px solid ${isActive ? token.colorPrimary : 'transparent'}`,
                }}
              >
                <Tooltip title={t(kind.tooltipKey)}>
                  <span style={{ color: kind.color, fontSize: 12, flexShrink: 0, width: 14, textAlign: 'center' }}>
                    {kind.icon}
                  </span>
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
                    <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>{hunkCounts.get(f.id)}</Tag>
                  </Tooltip>
                ) : null}
                <Tag color={status.color} style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>
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
