/**
 * ConsoleView — the Git tool window's read-only Console tab (the
 * reference VCS-console precedent): every state-changing git command
 * the engine ran in this workspace's repo, timestamped, with its
 * combined output beneath — a transparency feed, never an input.
 * Auto-follows the tail like a terminal, in the terminal's face. A
 * gutter on the left edge carries the view verbs (the reference's
 * console toolbar): Soft-Wrap, Fold Options and Shorten Paths (toggles),
 * Scroll to End (one jump, not a follow mode) and Clear All. One
 * tooltip serves every folded run and shortened path in the feed.
 */

import { DeleteOutlined } from '@ant-design/icons';
import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { theme, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { FoldOptionsIcon, ScrollToEndIcon, ShortenPathsIcon, SoftWrapIcon } from '@openheaders/ui/shared/icons';
import ConsoleRow from './ConsoleRow';
import type { GitConsolePrefs } from './git-console-view-state';
import ToolbarIconButton from './toolbar/ToolbarIconButton';
import type { ConsoleFont } from './use-console-font';
import { useFeedHover } from './use-feed-hover';

export interface ConsoleViewProps {
  rows: WorkspaceTreeGitConsoleRowWire[];
  prefs: GitConsolePrefs;
  font: ConsoleFont;
  /** Rows whose options run was clicked open, by ring id. */
  expanded: ReadonlySet<number>;
  onToggleExpanded: (seq: number) => void;
  onTogglePref: (key: keyof GitConsolePrefs) => void;
  onClear: () => void;
}

const ConsoleView: React.FC<ConsoleViewProps> = ({
  rows,
  prefs,
  font,
  expanded,
  onToggleExpanded,
  onTogglePref,
  onClear,
}) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hover = useFeedHover();

  const scrollToEnd = (): void => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Follow the tail on every refresh, terminal-style.
  useEffect(scrollToEnd, [rows]);

  // Soft-Wrap off keeps every line whole and scrolls sideways.
  const lineStyle: React.CSSProperties = prefs.softWrap
    ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
    : { whiteSpace: 'pre' };

  const anchor = hover.anchor;

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
      <div
        data-testid="git-tool-console-bar"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '6px 3px',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <ToolbarIconButton
          icon={<SoftWrapIcon />}
          title={t('workbench.gitLog.console.softWrap')}
          onClick={() => onTogglePref('softWrap')}
          active={prefs.softWrap}
          tooltipPlacement="right"
          testid="git-tool-console-wrap"
        />
        <ToolbarIconButton
          icon={<FoldOptionsIcon />}
          title={t('workbench.gitLog.console.foldOptions')}
          onClick={() => onTogglePref('foldOptions')}
          active={prefs.foldOptions}
          tooltipPlacement="right"
          testid="git-tool-console-fold-options"
        />
        <ToolbarIconButton
          icon={<ShortenPathsIcon />}
          title={t('workbench.gitLog.console.shortenPaths')}
          onClick={() => onTogglePref('shortenPaths')}
          active={prefs.shortenPaths}
          tooltipPlacement="right"
          testid="git-tool-console-shorten-paths"
        />
        <ToolbarIconButton
          icon={<ScrollToEndIcon />}
          title={t('workbench.gitLog.console.scrollToEnd')}
          onClick={scrollToEnd}
          disabled={rows.length === 0}
          tooltipPlacement="right"
          testid="git-tool-console-scroll-end"
        />
        <ToolbarIconButton
          icon={<DeleteOutlined />}
          title={t('workbench.gitLog.console.clearAll')}
          onClick={onClear}
          disabled={rows.length === 0}
          tooltipPlacement="right"
          testid="git-tool-console-clear"
        />
      </div>
      <div
        ref={scrollRef}
        {...hover.handlers}
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          padding: '8px 14px',
          fontFamily: font.family,
          fontSize: font.size,
          lineHeight: 1.5,
        }}
        data-testid="git-tool-console"
      >
        {rows.length === 0 ? (
          <div style={{ color: token.colorTextSecondary, fontFamily: token.fontFamily, fontSize: 12 }}>
            {t('workbench.gitLog.console.empty')}
          </div>
        ) : (
          rows.map((row) => (
            <ConsoleRow
              key={row.seq}
              row={row}
              posture={{
                foldOptions: prefs.foldOptions,
                shortenPaths: prefs.shortenPaths,
                expanded: expanded.has(row.seq),
              }}
              locale={locale}
              lineStyle={lineStyle}
              onToggleExpanded={onToggleExpanded}
            />
          ))
        )}
        <Tooltip
          open={anchor !== null}
          placement="top"
          styles={{ root: { maxWidth: 640, pointerEvents: 'none' } }}
          title={
            anchor === null ? null : (
              <span
                data-testid="git-tool-console-hover"
                style={{ fontFamily: font.family, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {anchor.text}
              </span>
            )
          }
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              top: anchor?.top ?? 0,
              left: anchor?.left ?? 0,
              width: anchor?.width ?? 0,
              height: anchor?.height ?? 0,
            }}
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default ConsoleView;
