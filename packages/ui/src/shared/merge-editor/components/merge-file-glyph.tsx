/**
 * What the file rail draws that the editor cannot know by itself — the
 * caller's vocabulary for a session's sections, groups and files (the
 * editor stays domain-agnostic) — and the glyph before a file's name:
 * the caller's icon for the file when it supplies one, else the kind
 * glyph (added / modified / removed). The statuses a rail row and the
 * collapsed rail share live here too.
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

/** A section files can name (`MergeFile.section`). */
export interface MergeRailSection {
  id: string;
  label: string;
  icon: ReactNode;
}

/** A group's name and glyph within its section. */
export interface MergeRailGroup {
  label: string;
  icon?: ReactNode;
}

export interface MergeRailVocabulary {
  /** The sections, in listing order. */
  sections: ReadonlyArray<MergeRailSection>;
  /** A group as the rail names it; absent = the group as written, no glyph. */
  group?(section: string, group: string): MergeRailGroup;
  /** A file's glyph; absent (or null) = the kind glyph. */
  fileIcon?(file: MergeFile): ReactNode;
}

/** What a files panel is handed — the modal's own state for the session's files. */
export interface MergeFilesPanelProps {
  files: ReadonlyArray<MergeFile>;
  activeFileId: string;
  /** State per file id. Missing entries are unresolved. */
  states?: ReadonlyMap<string, MergeFileRowState>;
  /** What is left to answer per file id. */
  hunkCounts?: ReadonlyMap<string, number>;
  /** Set when one section alone is wanted — the strip's flyout over a shut panel. */
  section?: string;
  onSelect(fileId: string): void;
}

/** A caller's own files panel, in place of the editor's list — a tree in the caller's vocabulary. */
export type MergeFilesRenderer = (panel: MergeFilesPanelProps) => ReactNode;

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

/** A fixed-width slot a header's or a row's glyph sits in. */
export function RailGlyph({ children, size }: { children: ReactNode; size: number }): ReactElement {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 18,
        fontSize: size,
      }}
    >
      {children}
    </span>
  );
}

export function MergeFileGlyph({ file, rail }: { file: MergeFile; rail?: MergeRailVocabulary }): ReactElement {
  const own = rail?.fileIcon?.(file) ?? null;
  if (own !== null) return <RailGlyph size={14}>{own}</RailGlyph>;
  const kind = KIND_ICONS[file.kind];
  return (
    <RailGlyph size={12}>
      <span style={{ color: kind.color, display: 'inline-flex' }}>{kind.icon}</span>
    </RailGlyph>
  );
}
