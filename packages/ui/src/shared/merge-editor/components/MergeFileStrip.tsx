/**
 * The file rail, collapsed: dragging the rail's sash shut leaves this
 * narrow strip instead of nothing — one chip per section, wearing the
 * section's glyph, in the rail's own order. The section that holds the
 * open file wears the selection blue and any other chip answers the
 * pointer, as the rail's rows do (`merge-file-list.css`). Pointing at a
 * chip lists the section's files under their groups; choosing one opens
 * it, and a click on the chip itself opens the section's first file
 * still waiting on an answer. A session that names no sections is one
 * chip over all its files.
 */

import { FileTextOutlined } from '@ant-design/icons';
import { Menu, type MenuProps, Popover, Tag, theme } from 'antd';
import type { ReactElement } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { listFiles, type MergeFileSection, sectionFiles } from '../file-groups';
import type { MergeFile } from '../types';
import { MergeFileGlyph, type MergeRailVocabulary, RailGlyph } from './merge-file-glyph';
import './merge-file-list.css';

/** The strip's width in px — the modal reserves it beside the editors. */
export const MERGE_FILE_STRIP_WIDTH = 40;

export interface MergeFileStripProps {
  files: ReadonlyArray<MergeFile>;
  activeFileId: string;
  hunkCounts?: ReadonlyMap<string, number>;
  rail?: MergeRailVocabulary;
  onSelect(fileId: string): void;
}

const MergeFileStrip = ({ files, activeFileId, hunkCounts, rail, onSelect }: MergeFileStripProps): ReactElement => {
  const { token } = theme.useToken();
  const t = useT();
  const sections = listFiles(
    files,
    rail?.sections.map((section) => section.id),
  );
  const remainingOf = (file: MergeFile): number => hunkCounts?.get(file.id) ?? 0;

  const menuOf = (listed: MergeFileSection): NonNullable<MenuProps['items']> => {
    const items: NonNullable<MenuProps['items']> = [];
    for (const { group, files: grouped } of listed.groups) {
      const entries = grouped.map((file) => ({
        key: file.id,
        icon: <MergeFileGlyph file={file} rail={rail} />,
        label: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span>{file.label}</span>
            {remainingOf(file) > 0 ? (
              <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>{remainingOf(file)}</Tag>
            ) : null}
          </span>
        ),
      }));
      const label = group !== '' ? (rail?.group?.(listed.section, group).label ?? group) : '';
      if (label !== '') items.push({ type: 'group', key: `group:${group}`, label, children: entries });
      else items.push(...entries);
    }
    return items;
  };

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
        background: token.colorFillTertiary,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '6px 0',
      }}
    >
      {sections.map((listed) => {
        const named = rail?.sections.find((known) => known.id === listed.section);
        const held = sectionFiles(listed);
        const label = named?.label ?? t('shared.mergeEditor.sessionScope.files', { count: held.length });
        const next = held.find((file) => remainingOf(file) > 0) ?? held[0];
        return (
          <Popover
            key={listed.section || '_'}
            placement="rightTop"
            arrow={false}
            title={label}
            content={
              <Menu
                items={menuOf(listed)}
                selectedKeys={[activeFileId]}
                onClick={({ key }) => onSelect(key)}
                style={{ border: 'none', background: 'transparent', minWidth: 200 }}
              />
            }
          >
            <button
              type="button"
              className="oh-merge__file-row"
              data-section={listed.section}
              aria-current={held.some((file) => file.id === activeFileId)}
              aria-label={label}
              onClick={() => {
                if (next !== undefined) onSelect(next.id);
              }}
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
              <RailGlyph size={16}>{named?.icon ?? <FileTextOutlined />}</RailGlyph>
            </button>
          </Popover>
        );
      })}
    </div>
  );
};

export default MergeFileStrip;
