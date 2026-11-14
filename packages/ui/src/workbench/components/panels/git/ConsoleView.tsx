/**
 * ConsoleView — the Git tool window's read-only Console tab (the
 * reference VCS-console precedent): every state-changing git command
 * the engine ran in this workspace's repo, timestamped, with its
 * combined output beneath — a transparency feed, never an input.
 * It reads as a text view does: the feed takes focus and shows a
 * caret — at its end until a click or the arrow keys place it — text
 * is selected by pointer and by keyboard, the selection's other
 * occurrences are marked, and a right-click offers Copy (the text as
 * it was: a shortened path whole, a folded run with every option) and
 * Clear All. It follows its tail like a terminal while the caret is
 * at the end, in the terminal's face. A gutter on the left edge
 * carries the view verbs (the reference's console toolbar): Soft-Wrap,
 * Fold Options and Shorten Paths (toggles), Scroll to End (the caret
 * goes back to the end) and Clear All. One tooltip serves every folded
 * run and shortened path in the feed.
 */

import { DeleteOutlined } from '@ant-design/icons';
import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { Dropdown, theme, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { FoldOptionsIcon, ScrollToEndIcon, ShortenPathsIcon, SoftWrapIcon } from '@openheaders/ui/shared/icons';
import { isMac } from '@openheaders/ui/shared/platform';
import ConsoleRow from './ConsoleRow';
import { buildConsoleMenu } from './console-menu';
import type { GitConsolePrefs } from './git-console-view-state';
import { contextMenuAlign } from './git-menu-overflow';
import ToolbarIconButton from './toolbar/ToolbarIconButton';
import type { ConsoleFont } from './use-console-font';
import { useFeedCaret } from './use-feed-caret';
import { useFeedHover } from './use-feed-hover';
import { useFeedOccurrences } from './use-feed-occurrences';

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
  const contentRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const hover = useFeedHover();
  const caret = useFeedCaret({ feed: scrollRef, content: contentRef, tail: tailRef });
  useFeedOccurrences(contentRef);
  // What was selected when the menu opened — its Copy copies that and puts the selection back, whatever a
  // press on the menu did to it.
  const [menuText, setMenuText] = useState('');
  const restoreSelection = useRef<() => void>(() => undefined);

  const scrollToEnd = (): void => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Follow the tail on a refresh, terminal-style — while the caret is at the end: a caret placed in the
  // feed, or a selection held in it, is being read and stays in view.
  const { atEnd } = caret;
  useEffect(() => {
    if (atEnd()) scrollToEnd();
  }, [rows, atEnd]);

  const menu = buildConsoleMenu(
    t,
    { canCopy: menuText !== '', canClear: rows.length > 0, copyHint: isMac ? '⌘C' : 'Ctrl+C' },
    {
      onCopy: () => {
        void navigator.clipboard.writeText(menuText);
        restoreSelection.current();
      },
      onClear,
    },
  );

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
          onClick={() => {
            caret.toEnd();
            scrollToEnd();
          }}
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
      <Dropdown
        menu={menu}
        trigger={['contextMenu']}
        align={contextMenuAlign}
        classNames={{ root: 'commit-tool-row-menu' }}
        onOpenChange={(open, info) => {
          if (open) {
            setMenuText(caret.selectedText());
            restoreSelection.current = caret.hold();
          }
          // After a pick the keys go back to the feed; a click elsewhere took the focus where it went.
          else if (info.source === 'menu') scrollRef.current?.focus({ preventScroll: true });
        }}
      >
        <div
          ref={scrollRef}
          {...hover.handlers}
          {...caret.handlers}
          // A text view: it takes the keyboard, and its caret says so.
          tabIndex={0}
          role="log"
          aria-label={t('workbench.gitLog.console.tab')}
          className="git-console-feed"
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
            <div ref={contentRef} data-testid="git-tool-console-lines">
              {rows.map((row) => (
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
              ))}
              {/* The empty last line — where the next row lands, and where the caret stands until it is placed. */}
              <div ref={tailRef} style={{ minHeight: '1.5em' }} data-testid="git-tool-console-tail" />
            </div>
          )}
          {caret.box !== null && (
            <span
              // A move starts the blink over, as a text view's caret does.
              key={caret.beat}
              aria-hidden="true"
              className="git-console-caret"
              data-blink={caret.focused ? '' : undefined}
              data-testid="git-tool-console-caret"
              style={{ top: caret.box.top, left: caret.box.left, height: caret.box.height }}
            />
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
      </Dropdown>
    </div>
  );
};

export default ConsoleView;
