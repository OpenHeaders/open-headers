/**
 * The glyph before a file's name in the rail, and alone on the
 * collapsed rail: the caller's own icon for the file when it supplies
 * one (what the file is, in the host's vocabulary — the editor stays
 * domain-agnostic), else the kind glyph (added / modified / removed).
 * The statuses a rail row and a strip chip share live here too.
 */

import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import type { ReactElement, ReactNode } from 'react';
import type { MergeFile, MergeFileKind } from '../types';

export type MergeFileStatus = 'unresolved' | 'partial' | 'resolved' | 'failed';

export interface MergeFileRowState {
  status: MergeFileStatus;
  /** Adapter-side error from Apply, when status === 'failed'. */
  error?: string;
}

/** The caller's icon for a file; null or undefined falls back to the kind glyph. */
export type RenderMergeFileIcon = (file: MergeFile) => ReactNode;

export const KIND_ICONS: Record<MergeFileKind, { icon: ReactElement; color: string; tooltipKey: MessageKey }> = {
  add: { icon: <PlusCircleOutlined />, color: '#52c41a', tooltipKey: 'shared.mergeEditor.fileList.kindAdded' },
  modify: {
    icon: <span style={{ fontWeight: 700 }}>·</span>,
    color: '#1677ff',
    tooltipKey: 'shared.mergeEditor.fileList.kindModified',
  },
  remove: { icon: <MinusCircleOutlined />, color: '#ff4d4f', tooltipKey: 'shared.mergeEditor.fileList.kindRemoved' },
};

export const STATUS_TAG: Record<MergeFileStatus, { color: string; labelKey: MessageKey }> = {
  unresolved: { color: 'default', labelKey: 'shared.mergeEditor.fileList.statusUnresolved' },
  partial: { color: 'warning', labelKey: 'shared.mergeEditor.fileList.statusPartial' },
  resolved: { color: 'success', labelKey: 'shared.mergeEditor.fileList.statusResolved' },
  failed: { color: 'error', labelKey: 'shared.mergeEditor.fileList.statusFailed' },
};

export interface MergeFileGlyphProps {
  file: MergeFile;
  renderIcon?: RenderMergeFileIcon;
  /** The caller's icon size in px; the kind glyph keeps its own. */
  size: number;
}

export function MergeFileGlyph({ file, renderIcon, size }: MergeFileGlyphProps): ReactElement {
  const own = renderIcon?.(file) ?? null;
  const kind = KIND_ICONS[file.kind];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 18,
        fontSize: own !== null ? size : 12,
        ...(own !== null ? {} : { color: kind.color }),
      }}
    >
      {own ?? kind.icon}
    </span>
  );
}
