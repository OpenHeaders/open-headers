/**
 * The file rail's activity strip — always there beside the files
 * panel, as the workbench's activity bar is beside its tool windows:
 * one chip per section the session holds, wearing the section's glyph,
 * in the rail's own order, with the number of its files still waiting
 * on an answer.
 *
 * The section the open file belongs to is the active one: its chip
 * wears the selection blue and the panel lists its files; any other
 * chip answers the pointer (`merge-file-list.css`). A click on another
 * chip goes to that section — its first file left to answer opens, and
 * the panel shows if it was shut. A click on the active chip shuts the
 * panel or brings it back, as dragging its sash does. While the panel
 * is shut, pointing at a chip lists the section's files in a flyout; a
 * session that names no sections is one chip over all its files.
 */

import { FileTextOutlined } from '@ant-design/icons';
import { Badge, Popover, Tooltip, theme } from 'antd';
import type { ReactElement } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { listFiles, type MergeFileSection, sectionFiles } from '../file-groups';
import type { MergeFile } from '../types';
import { MergeFileGlyph, type MergeRailVocabulary, RailGlyph } from './merge-file-glyph';
import './merge-file-list.css';

/** The strip's width in px — the modal reserves it beside the panel. */
export const MERGE_FILE_STRIP_WIDTH = 40;

export interface MergeFileStripProps {
  files: ReadonlyArray<MergeFile>;
  activeFileId: string;
  hunkCounts?: ReadonlyMap<string, number>;
  rail?: MergeRailVocabulary;
  /** Whether the files panel is shut — by its sash or by the active chip. */
  panelHidden: boolean;
  onPanelHidden(hidden: boolean): void;
  onSelect(fileId: string): void;
}

const MergeFileStrip = ({
  files,
  activeFileId,
  hunkCounts,
  rail,
  panelHidden,
  onPanelHidden,
  onSelect,
}: MergeFileStripProps): ReactElement => {
  const { token } = theme.useToken();
  const t = useT();
  const sections = listFiles(
    files,
    rail?.sections.map((section) => section.id),
  );
  const remainingOf = (file: MergeFile): number => hunkCounts?.get(file.id) ?? 0;

  // The flyout: the section's files under their groups, at the rail's own density.
  const flyoutOf = (listed: MergeFileSection): ReactElement => (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200, maxWidth: 360, margin: '0 -6px' }}>
      {listed.groups.map(({ group, files: grouped }) => {
        const known = group !== '' ? rail?.group?.(listed.section, group) : undefined;
        const label = known?.label ?? group;
        return (
          <div key={group || '_'}>
            {label !== '' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: token.colorTextSecondary,
                }}
              >
                {known?.icon !== undefined ? <RailGlyph size={13}>{known.icon}</RailGlyph> : null}
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
            ) : null}
            {grouped.map((file) => (
              <button
                type="button"
                key={file.id}
                className="oh-merge__file-row"
                data-file={file.id}
                aria-current={file.id === activeFileId}
                onClick={() => onSelect(file.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 4,
                  padding: `4px 6px 4px ${label !== '' ? 20 : 6}px`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: token.colorText,
                }}
              >
                <MergeFileGlyph file={file} rail={rail} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.label}
                </span>
                {remainingOf(file) > 0 ? (
                  <span style={{ fontSize: 10, color: token.colorTextSecondary }}>{remainingOf(file)}</span>
                ) : null}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      data-testid="merge-file-strip"
      style={{
        flex: `0 0 ${MERGE_FILE_STRIP_WIDTH}px`,
        boxSizing: 'border-box',
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'none',
        scrollbarWidth: 'none',
        background: token.colorFillSecondary,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '6px 0',
      }}
    >
      {sections.map((listed) => {
        const named = rail?.sections.find((known) => known.id === listed.section);
        const held = sectionFiles(listed);
        const label = named?.label ?? t('shared.mergeEditor.sessionScope.files', { count: held.length });
        const waiting = held.filter((file) => remainingOf(file) > 0);
        const active = held.some((file) => file.id === activeFileId);
        const chip = (
          <button
            type="button"
            className="oh-merge__file-row"
            data-section={listed.section}
            aria-current={active}
            aria-label={label}
            aria-expanded={active ? !panelHidden : undefined}
            onClick={() => {
              if (active) {
                onPanelHidden(!panelHidden);
                return;
              }
              const next = waiting[0] ?? held[0];
              if (next !== undefined) onSelect(next.id);
              onPanelHidden(false);
            }}
            style={{
              width: 28,
              height: 28,
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
            <RailGlyph size={16}>{named?.icon ?? <FileTextOutlined />}</RailGlyph>
          </button>
        );
        const badged = (
          <Badge count={waiting.length} size="small" color={token.colorPrimary} offset={[-2, 2]}>
            {chip}
          </Badge>
        );
        return panelHidden ? (
          <Popover key={listed.section || '_'} placement="rightTop" arrow={false} title={label} content={flyoutOf(listed)}>
            {badged}
          </Popover>
        ) : (
          <Tooltip key={listed.section || '_'} placement="right" title={label}>
            {badged}
          </Tooltip>
        );
      })}
    </div>
  );
};

export default MergeFileStrip;
