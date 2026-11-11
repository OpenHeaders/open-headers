/**
 * Phase 5 — multi-file shell sidebar.
 *
 * Plan §5.3: ~280px collapsible left rail with one row per file, listed
 * as `file-groups.ts` orders them: by section, then by group. A section
 * (`MergeFile.section`) is a header the caller's vocabulary names and
 * draws — its glyph, its label; a group (`MergeFile.group`) is a header
 * under it, and the files sit under their group. A session that names
 * no sections lists by group alone. Each row carries its glyph (the
 * caller's icon for the file, else the add/modify/remove kind), a
 * status pill, and any adapter-supplied badges.
 *
 * The modal decides whether a session lists its files; the list
 * renders whatever it is handed, one file included, and keeps the open
 * file's row in view — a chip of the strip beside it (`MergeFileStrip`)
 * opens a file of its section, and the list follows.
 *
 * The rail sits one fill step off the surface under it — the modal's,
 * which the editors beside it leave for their own — so it reads as a
 * panel of its own in every theme; the open file is the one solid
 * selection blue the workbench's tree rows wear, and any other row
 * answers the pointer (`merge-file-list.css`). The neutral chips (the
 * count, `unresolved`) are a translucent fill too: an opaque one is the
 * rail's own colour and would show only on a hovered or open row.
 *
 * Status pill colors mirror the plan's vocabulary:
 *   unresolved  = neutral
 *   partial     = warning
 *   resolved    = success
 *   failed      = error  (after Apply outcome)
 */

import { CheckCircleFilled, SwapOutlined, WarningFilled } from '@ant-design/icons';
import { Tag, Tooltip, theme } from 'antd';
import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { listFiles } from '../file-groups';
import type { MergeFile } from '../types';
import {
  KIND_ICONS,
  MergeFileGlyph,
  type MergeFileRowState,
  type MergeRailVocabulary,
  RailGlyph,
  STATUS_TAG,
} from './merge-file-glyph';
import './merge-file-list.css';

export interface MergeFileListProps {
  files: ReadonlyArray<MergeFile>;
  activeFileId: string;
  /** Optional state per file id. Missing entries default to unresolved. */
  states?: ReadonlyMap<string, MergeFileRowState>;
  /** Optional remaining-hunk count per file. Missing entries omit the
   *  badge. Active file should reflect live stats; inactive files get
   *  the initial-state count from session-open. */
  hunkCounts?: ReadonlyMap<string, number>;
  /** The caller's names and glyphs for sections, groups and files. */
  rail?: MergeRailVocabulary;
  onSelect(fileId: string): void;
}

/** A level's indent: sections at the edge, their groups and files one step in each. */
const INDENT = 14;
const EDGE = 12;

const MergeFileList = ({
  files,
  activeFileId,
  states,
  hunkCounts,
  rail,
  onSelect,
}: MergeFileListProps): ReactElement => {
  const { token } = theme.useToken();
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);

  // The open file's row stays in view: a file opened from elsewhere
  // (the strip, the editor's first file) may sit below the fold.
  useEffect(() => {
    listRef.current?.querySelector('.oh-merge__file-row[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeFileId]);

  const sections = listFiles(
    files,
    rail?.sections.map((section) => section.id),
  );
  const chipStyle = { margin: 0, fontSize: 10, lineHeight: '16px' };
  const neutralChipStyle = { ...chipStyle, background: token.colorFillTertiary };

  // Paired-row resolution (plan §5.3 v1: visual pairing only,
  // independent resolution per row). A row is "paired" when both
  // sides of the pair exist in the same session.
  const fileIds = new Set(files.map((f) => f.id));
  const isPaired = (file: MergeFile): boolean => file.pairedWith !== undefined && fileIds.has(file.pairedWith);
  const partnerLabel = (file: MergeFile): string | undefined => {
    if (!file.pairedWith) return undefined;
    return files.find((f) => f.id === file.pairedWith)?.label;
  };

  const row = (f: MergeFile, depth: number): ReactElement => {
    const state = states?.get(f.id) ?? { status: 'unresolved' as const };
    const status = STATUS_TAG[state.status];
    const remaining = hunkCounts?.get(f.id) ?? 0;
    return (
      <button
        type="button"
        key={f.id}
        className="oh-merge__file-row"
        aria-current={f.id === activeFileId}
        onClick={() => onSelect(f.id)}
        style={{
          width: '100%',
          textAlign: 'left',
          border: 'none',
          padding: `6px ${EDGE}px 6px ${EDGE + depth * INDENT}px`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: token.colorText,
        }}
      >
        <Tooltip title={t(KIND_ICONS[f.kind].tooltipKey)}>
          <span style={{ display: 'inline-flex' }}>
            <MergeFileGlyph file={f} rail={rail} />
          </span>
        </Tooltip>
        <span
          style={{ flex: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
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
        {remaining > 0 ? (
          <Tooltip title={t('shared.mergeEditor.fileList.hunksRemaining', { count: remaining })}>
            <Tag style={neutralChipStyle}>{remaining}</Tag>
          </Tooltip>
        ) : null}
        <Tag color={status.color} style={status.color === 'default' ? neutralChipStyle : chipStyle}>
          {t(status.labelKey)}
        </Tag>
        {state.status === 'resolved' ? <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 12 }} /> : null}
      </button>
    );
  };

  return (
    <div
      ref={listRef}
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
      {sections.map(({ section, groups }) => {
        const named = rail?.sections.find((known) => known.id === section);
        const depth = named ? 1 : 0;
        const showGroupHeaders = named !== undefined || groups.some((g) => g.group !== '');
        // A group the caller names reads as written; a bare group id keeps the strip's capitals.
        const groupCase: CSSProperties = named ? {} : { fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' };
        return (
          <div key={section || '_'} data-section={section} style={{ marginBottom: 6 }}>
            {named ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `6px ${EDGE}px 4px`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: token.colorText,
                }}
              >
                <RailGlyph size={14}>{named.icon}</RailGlyph>
                <span>{named.label}</span>
              </div>
            ) : null}
            {groups.map(({ group, files: listed }) => {
              const known = group !== '' ? rail?.group?.(section, group) : undefined;
              const label = known?.label ?? (group || (named ? '' : t('shared.mergeEditor.groupOther')));
              const headed = showGroupHeaders && label !== '';
              return (
                <div key={group || '_'} data-group={group}>
                  {headed ? (
                    <div
                      title={label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: `4px ${EDGE}px 4px ${EDGE + depth * INDENT}px`,
                        fontSize: 11,
                        fontWeight: 600,
                        color: token.colorTextSecondary,
                        ...groupCase,
                      }}
                    >
                      {known?.icon !== undefined ? <RailGlyph size={13}>{known.icon}</RailGlyph> : null}
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>
                  ) : null}
                  {listed.map((f) => row(f, headed ? depth + 1 : depth))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default MergeFileList;
