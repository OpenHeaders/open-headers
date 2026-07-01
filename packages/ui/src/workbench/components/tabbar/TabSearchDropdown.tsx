/**
 * TabSearchDropdown — the tab-strip search overlay behind the chevron
 * affordance (right-aligned). Filters open tabs by their live display
 * label, lists recently closed tabs in a collapsible section, and supports
 * keyboard navigation (↑/↓ to move, Enter to switch/reopen, Esc to
 * dismiss). Owns its own search/focus/expansion state and input ref;
 * every entity lookup and callback arrives as a prop.
 */

import { FolderOpenOutlined, SearchOutlined } from '@ant-design/icons';
import type { LiveWorkflow, Request, Rule, Template } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Input, theme } from 'antd';
import type React from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { ClosedTab, WorkbenchTab } from '../../types';
import { isCreateDraftMode, tabIcon } from './tab-format';

interface TabSearchProps {
  open: boolean;
  onClose: () => void;
  tabs: WorkbenchTab[];
  activeTabId: string | null;
  rules: Rule[];
  templates: Template[];
  requests: Request[];
  pausedUids: ReadonlySet<string>;
  unresolvableRuleUids: ReadonlySet<string>;
  unresolvableRequestUids: ReadonlySet<string>;
  liveWorkflows: LiveWorkflow[];
  unresolvableWorkflowUids: ReadonlySet<string>;
  /** Breadcrumb path for a tab (workspace excluded) — rendered as muted
   *  secondary line so users can disambiguate rows with the same name. */
  getTabPath?: (tab: WorkbenchTab) => string[];
  /** Live-derived display label per tab. Search filters and row labels
   *  read from this so renames in any surface land here without an
   *  imperative sync. */
  getDisplayLabel: (tab: WorkbenchTab) => string;
  onSwitch: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
  onReopen: (closed: ClosedTab) => void;
}

const TabSearchDropdown: React.FC<TabSearchProps> = ({
  open,
  onClose,
  tabs,
  activeTabId,
  rules,
  templates,
  requests,
  pausedUids,
  unresolvableRuleUids,
  unresolvableRequestUids,
  liveWorkflows,
  unresolvableWorkflowUids,
  getTabPath,
  getDisplayLabel,
  onSwitch,
  recentlyClosed,
  onReopen,
}) => {
  const { token } = theme.useToken();
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setFocusedIndex(0);
      setClosedExpanded(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const lowerSearch = search.toLowerCase();
  const filteredTabs = tabs.filter((t) => getDisplayLabel(t).toLowerCase().includes(lowerSearch));
  const filteredClosed = recentlyClosed.filter((c) => getDisplayLabel(c.tab).toLowerCase().includes(lowerSearch));
  const totalItems = filteredTabs.length + (closedExpanded ? filteredClosed.length : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, totalItems - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex < filteredTabs.length) {
        onSwitch(filteredTabs[focusedIndex].id);
        onClose();
      } else if (closedExpanded) {
        const closedIdx = focusedIndex - filteredTabs.length;
        if (filteredClosed[closedIdx]) {
          onReopen(filteredClosed[closedIdx]);
          onClose();
        }
      }
    }
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      <div className="rules-tab-search-backdrop" onClick={onClose} />
      <div
        className="rules-tab-search-dropdown"
        style={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ padding: '8px 8px 4px' }}>
          <Input
            ref={inputRef}
            size="small"
            placeholder="Search tabs..."
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            allowClear
            variant="borderless"
            style={{ fontSize: 12 }}
          />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '0 4px 4px' }}>
          {/* Open tabs */}
          {filteredTabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            const isFocused = idx === focusedIndex;
            const path = getTabPath?.(tab) ?? [];
            // Secondary line = breadcrumb minus the entity (last) segment.
            // Nothing to show for single-segment paths (Settings, etc.).
            const secondarySegments = path.length > 1 ? path.slice(0, -1) : [];
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: handled by parent onKeyDown
              // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
              <div
                key={tab.id}
                className="rules-tab-search-item"
                style={{
                  ...(isFocused ? { background: token.colorFillSecondary } : null),
                  fontWeight: isActive ? 500 : 400,
                  alignItems: 'flex-start',
                }}
                onClick={() => {
                  onSwitch(tab.id);
                  onClose();
                }}
              >
                <span
                  style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontSize: 13, marginTop: 1 }}
                >
                  {tabIcon(
                    tab,
                    rules,
                    templates,
                    pausedUids,
                    requests,
                    unresolvableRequestUids,
                    unresolvableRuleUids,
                    liveWorkflows,
                    unresolvableWorkflowUids,
                    { compact: true },
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {getDisplayLabel(tab)}
                  </span>
                  {secondarySegments.length > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        fontSize: 10,
                        color: token.colorTextTertiary,
                        fontWeight: 400,
                      }}
                    >
                      {secondarySegments.map((seg, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: path segments are inherently positional
                        <Fragment key={`${seg}-${i}`}>
                          {i > 0 && <span style={{ margin: '0 4px' }}>{'›'}</span>}
                          {i > 0 && <FolderOpenOutlined style={{ fontSize: 9, marginRight: 3 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg}</span>
                        </Fragment>
                      ))}
                    </span>
                  )}
                </span>
                {(isCreateDraftMode(tab) || tab.dirty) && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isCreateDraftMode(tab) ? '#999' : '#ff7875',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Recently closed section */}
          {recentlyClosed.length > 0 && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: toggle section */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: toggle section */}
              <div
                className="rules-tab-search-item"
                style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary, marginTop: 4 }}
                onClick={() => setClosedExpanded((v) => !v)}
              >
                <span style={{ fontSize: 9, marginRight: 4 }}>{closedExpanded ? '\u25BC' : '\u25B6'}</span>
                Recently Closed ({recentlyClosed.length})
              </div>
              {closedExpanded &&
                filteredClosed.map((closed, idx) => {
                  const globalIdx = filteredTabs.length + idx;
                  const isFocused = globalIdx === focusedIndex;
                  const path = getTabPath?.(closed.tab) ?? [];
                  const secondarySegments = path.length > 1 ? path.slice(0, -1) : [];
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: handled by parent onKeyDown
                    // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
                    <div
                      key={`closed-${closed.tab.id}-${closed.closedAt}`}
                      className="rules-tab-search-item"
                      style={{
                        ...(isFocused ? { background: token.colorFillSecondary } : null),
                        opacity: 0.7,
                        alignItems: 'flex-start',
                      }}
                      onClick={() => {
                        onReopen(closed);
                        onClose();
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          flexShrink: 0,
                          fontSize: 13,
                          marginTop: 1,
                        }}
                      >
                        {tabIcon(
                          closed.tab,
                          rules,
                          templates,
                          pausedUids,
                          requests,
                          unresolvableRequestUids,
                          unresolvableRuleUids,
                          liveWorkflows,
                          unresolvableWorkflowUids,
                          { compact: true },
                        )}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 12,
                          }}
                        >
                          {getDisplayLabel(closed.tab)}
                        </span>
                        {secondarySegments.length > 0 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              fontSize: 10,
                              color: token.colorTextTertiary,
                            }}
                          >
                            {secondarySegments.map((seg, i) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: path segments are inherently positional
                              <Fragment key={`${seg}-${i}`}>
                                {i > 0 && <span style={{ margin: '0 4px' }}>{'›'}</span>}
                                {i > 0 && <FolderOpenOutlined style={{ fontSize: 9, marginRight: 3 }} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg}</span>
                              </Fragment>
                            ))}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
            </>
          )}

          {filteredTabs.length === 0 && filteredClosed.length === 0 && (
            <div style={{ padding: '12px 8px', fontSize: 12, color: token.colorTextTertiary, textAlign: 'center' }}>
              No matching tabs
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TabSearchDropdown;
