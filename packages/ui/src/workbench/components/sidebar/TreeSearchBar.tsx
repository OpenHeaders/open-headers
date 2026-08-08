/**
 * TreeSearchBar — the sidebar's transient speed-search row. Renders
 * only while the search subsystem is open (⋯ Options → Search,
 * Cmd/Ctrl+F inside the panel, or the focus-sidebar-filter shortcut)
 * in the slot the permanent filter input used to occupy.
 *
 * The input OWNS the keyboard while the bar is up: in search mode
 * ArrowUp/Down cycle matches and Enter opens the active one without
 * DOM focus ever leaving the field; in filter mode ArrowDown/Enter
 * hand off to the tree (the old filter-row semantics). Esc closes and
 * clears in both modes. The suffix cluster is a two-icon mode toggle
 * (search / filter) plus the match counter and a close ×; toggles
 * prevent mousedown so a click never steals the input's focus.
 */

import { CloseOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';
import { Input, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { TreeSearch, TreeSearchMatches, TreeSearchMode } from './useTreeSearch';

interface TreeSearchBarProps {
  search: TreeSearch;
  matches: TreeSearchMatches;
  /** Filter-mode ArrowDown/Enter — move DOM focus into the tree and
   *  put the cursor on the first visible row. */
  onJumpToTree: () => void;
  /** Close + clear, returning DOM focus to the tree container. */
  onClose: () => void;
}

function ModeToggle({
  mode,
  current,
  icon,
  tooltip,
  testid,
  onPick,
}: {
  mode: TreeSearchMode;
  current: TreeSearchMode;
  icon: React.ReactNode;
  tooltip: string;
  testid: string;
  onPick: (m: TreeSearchMode) => void;
}) {
  const active = mode === current;
  return (
    <Tooltip title={tooltip} placement="bottom">
      <span
        role="button"
        tabIndex={-1}
        aria-label={tooltip}
        aria-pressed={active}
        data-testid={testid}
        className={active ? 'rules-sidebar-search-toggle rules-sidebar-search-toggle--active' : 'rules-sidebar-search-toggle'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(mode)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onPick(mode);
        }}
      >
        {icon}
      </span>
    </Tooltip>
  );
}

export function TreeSearchBar({ search, matches, onJumpToTree, onClose }: TreeSearchBarProps) {
  const { token } = theme.useToken();
  const t = useT();
  const inputRef = useRef<InputRef>(null);

  // Focus on mount and on every host `focus()` request while already
  // open (the focusNonce bump). select() so a stale query is
  // type-over-able, the platform search-field convention.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusNonce is the re-focus signal
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [search.focusNonce]);

  const searching = search.mode === 'search' && search.query !== '';
  const noMatch = searching && matches.matchIds.length === 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (search.mode === 'search') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        matches.goNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        matches.goPrev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        matches.openActive();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      onJumpToTree();
    }
  };

  return (
    <div className="rules-sidebar-search-row" data-testid="sidebar-search-bar">
      <Input
        ref={inputRef}
        size="small"
        data-testid="sidebar-search-input"
        className={noMatch ? 'rules-sidebar-search-input rules-sidebar-search-input--nomatch' : 'rules-sidebar-search-input'}
        placeholder={
          search.mode === 'search' ? t('workbench.sidebar.search.searchPlaceholder') : t('workbench.sidebar.filterPlaceholder')
        }
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />}
        value={search.query}
        aria-invalid={noMatch}
        onChange={(e) => search.setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        suffix={
          <span className="rules-sidebar-search-suffix">
            {searching && (
              <span
                className="rules-sidebar-search-count"
                data-testid="sidebar-search-count"
                title={noMatch ? t('workbench.sidebar.search.noMatches') : undefined}
              >
                {noMatch ? '0/0' : `${matches.activeIndex + 1}/${matches.matchIds.length}`}
              </span>
            )}
            <ModeToggle
              mode="search"
              current={search.mode}
              icon={<SearchOutlined />}
              tooltip={t('workbench.sidebar.search.modeSearch')}
              testid="sidebar-search-mode-search"
              onPick={search.setMode}
            />
            <ModeToggle
              mode="filter"
              current={search.mode}
              icon={<FilterOutlined />}
              tooltip={t('workbench.sidebar.search.modeFilter')}
              testid="sidebar-search-mode-filter"
              onPick={search.setMode}
            />
            <Tooltip title={t('workbench.sidebar.search.close')} placement="bottom">
              <span
                role="button"
                tabIndex={-1}
                aria-label={t('workbench.sidebar.search.close')}
                data-testid="sidebar-search-close"
                className="rules-sidebar-search-toggle"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClose}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onClose();
                }}
              >
                <CloseOutlined />
              </span>
            </Tooltip>
          </span>
        }
      />
    </div>
  );
}
