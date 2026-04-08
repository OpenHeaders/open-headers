/**
 * TabBar — horizontal tab strip for editor tabs.
 *
 * Uses custom CSS tabs instead of antd Tabs to avoid EllipsisMeasure crashes
 * inside Allotment panes.
 *
 * Features: method-colored labels, unsaved dot, close on X, pinned tabs,
 * drag-and-drop reorder, right-click context menu, horizontal scroll,
 * + button (new Request/Rule), chevron dropdown (search/select open tabs).
 */

import {
  ApiOutlined,
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  GlobalOutlined,
  PlusOutlined,
  PushpinOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Dropdown, Input, type InputRef, Tooltip, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolvedTab } from './hooks/useResolvedTabs';
import type { Tab } from './hooks/useTabs';

const TAB_LABEL_MAX = 16;

/** Middle-truncate: keep prefix and suffix, ellipsis in the middle */
function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}\u2026${text.slice(text.length - half)}`;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

interface TabBarProps {
  tabs: ResolvedTab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
  onReorder: (fromId: string, toId: string, side: 'left' | 'right') => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseUnmodified: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  environments?: V5.Environment[];
  activeEnvironment?: string | null;
  onSwitchEnvironment?: (envName: string | null) => void;
  /** The collection the active tab belongs to (if any) — used for pin environment feature */
  activeCollection?: V5.Collection | null;
  onPinEnvironment?: (collectionId: string, envName: string | null) => void;
  onNewEnvironment?: () => void;
  onNewDraftEnvironment?: () => void;
  onToggleInspector?: () => void;
  recentlyClosed?: Tab[];
  onReopenTab?: (tab: Tab) => void;
}

function MethodBadge({ method, size = 'normal' }: { method: string; size?: 'normal' | 'small' }) {
  const color = METHOD_COLORS[method] || '#999';
  const fontSize = size === 'small' ? 7 : 8;
  return (
    <span
      style={{
        background: color,
        color: 'white',
        fontSize,
        fontWeight: 700,
        padding: '1px 3px',
        borderRadius: 2,
        flexShrink: 0,
        lineHeight: '14px',
      }}
    >
      {method}
    </span>
  );
}

function TabIcon({ tab }: { tab: ResolvedTab }) {
  const { token } = theme.useToken();

  if (tab.type === 'request' || tab.type === 'collection') {
    const method = tab.resolvedIcon || 'GET';
    const color = METHOD_COLORS[method] || token.colorPrimary;
    return (
      <span className="v5-method-badge" style={{ background: color }}>
        {method}
      </span>
    );
  }
  if (tab.type === 'rule') {
    return <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 12 }} />;
  }
  if (tab.type === 'environment') {
    return (
      <span
        style={{
          background: '#52c41a',
          color: 'white',
          fontSize: 9,
          fontWeight: 700,
          padding: '0 4px',
          borderRadius: 3,
          lineHeight: '16px',
        }}
      >
        E
      </span>
    );
  }
  if (tab.type === 'settings') {
    return <span style={{ fontSize: 11 }}>&#x2699;</span>;
  }
  return null;
}

// ── Tab search/select dropdown ──────────────────────────────────

function TabSearchDropdown({
  open,
  onClose,
  tabs,
  onSwitch,
  recentlyClosed,
  onReopen,
}: {
  open: boolean;
  onClose: () => void;
  tabs: ResolvedTab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  recentlyClosed: Tab[];
  onReopen: (tab: Tab) => void;
}) {
  const { token } = theme.useToken();
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setFocusedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset focused index when search changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on search change
  useEffect(() => {
    setFocusedIndex(0);
  }, [search]);

  const [closedExpanded, setClosedExpanded] = useState(false);

  if (!open) return null;

  const filter = search.toLowerCase();
  const filtered = tabs.filter(
    (t) =>
      t.type !== 'overview' &&
      (t.resolvedLabel.toLowerCase().includes(filter) || (t.resolvedIcon || '').toLowerCase().includes(filter)),
  );
  const filteredClosed = recentlyClosed.filter((t) => t.label.toLowerCase().includes(filter));

  const selectFocused = () => {
    if (filtered.length > 0 && focusedIndex < filtered.length) {
      onSwitch(filtered[focusedIndex].id);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
      setTimeout(() => {
        listRef.current?.querySelector('[data-focused="true"]')?.scrollIntoView({ block: 'nearest' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      setTimeout(() => {
        listRef.current?.querySelector('[data-focused="true"]')?.scrollIntoView({ block: 'nearest' });
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectFocused();
    }
  };

  const renderTabIcon = (tab: { type: string; icon?: string }) => {
    if (tab.type === 'request' || tab.type === 'collection') {
      return <MethodBadge method={tab.icon || 'GET'} />;
    }
    if (tab.type === 'rule') {
      return <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 11 }} />;
    }
    if (tab.type === 'environment') {
      return (
        <span
          style={{
            background: '#52c41a',
            color: 'white',
            fontSize: 8,
            fontWeight: 700,
            padding: '0 3px',
            borderRadius: 2,
          }}
        >
          E
        </span>
      );
    }
    if (tab.type === 'globals') {
      return <span style={{ fontSize: 10 }}>&#x1F310;</span>;
    }
    if (tab.type === 'settings') {
      return <span style={{ fontSize: 10 }}>&#x2699;</span>;
    }
    if (tab.type === 'collection-overview' || tab.type === 'folder-overview') {
      return <span style={{ fontSize: 10 }}>&#x1F4C1;</span>;
    }
    return null;
  };

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      <div
        className="v5-tab-search-backdrop"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        role="presentation"
      />
      <div
        className="v5-tab-search-dropdown"
        style={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}` }}
      >
        {/* Search */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Input
            ref={inputRef}
            placeholder="Search tabs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="borderless"
            size="small"
            style={{ flex: 1, fontSize: 12 }}
            onKeyDown={handleKeyDown}
          />
          <span style={{ fontSize: 10, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>&#x21E7;&#x2318;A</span>
        </div>

        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto' }}>
          {/* Open tabs */}
          {filtered.length > 0 ? (
            filtered.map((tab, index) => (
              <div
                key={tab.id}
                className="v5-tab-search-item"
                data-focused={index === focusedIndex}
                style={{
                  color: token.colorText,
                  background: index === focusedIndex ? token.colorBgTextHover : undefined,
                }}
                onClick={() => {
                  onSwitch(tab.id);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSwitch(tab.id);
                    onClose();
                  }
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                role="button"
                tabIndex={-1}
              >
                {renderTabIcon({ type: tab.type, icon: tab.resolvedIcon })}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab.resolvedLabel}
                </span>
                {tab.unsaved && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff7875', flexShrink: 0 }} />
                )}
              </div>
            ))
          ) : (
            <div style={{ padding: '12px', fontSize: 11, color: token.colorTextTertiary }}>No open tabs</div>
          )}

          {/* Recently closed */}
          {filteredClosed.length > 0 && (
            <>
              <div
                style={{
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setClosedExpanded((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setClosedExpanded((v) => !v);
                }}
                role="button"
                tabIndex={0}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: token.colorText }}>Recently closed</span>
                <DownOutlined
                  style={{
                    fontSize: 10,
                    color: token.colorTextTertiary,
                    transform: closedExpanded ? 'rotate(180deg)' : undefined,
                    transition: 'transform 0.2s',
                  }}
                />
              </div>
              {closedExpanded &&
                filteredClosed.map((tab) => (
                  <div
                    key={`closed-${tab.id}`}
                    className="v5-tab-search-item"
                    style={{ color: token.colorTextSecondary }}
                    onClick={() => {
                      onReopen(tab);
                      onClose();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onReopen(tab);
                        onClose();
                      }
                    }}
                    role="button"
                    tabIndex={-1}
                  >
                    {renderTabIcon(tab)}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.label}
                    </span>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Environment selector ────────────────────────────────────────

function EnvSelectorDropdown({
  open,
  onClose,
  environments,
  activeEnvironment,
  activeCollection,
  onSwitch,
  onPin,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  environments: V5.Environment[];
  activeEnvironment: string | null;
  activeCollection: V5.Collection | null;
  onSwitch: (envName: string | null) => void;
  onPin?: (collectionId: string, envName: string | null) => void;
  onCreate?: () => void;
}) {
  const { token } = theme.useToken();
  const [search, setSearch] = useState('');
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const pinnedId: string | undefined = undefined; // TODO: pinned env per collection
  const canPin = !!activeCollection && !!onPin;
  const filter = search.toLowerCase();
  const filtered = environments.filter((e) => e.name.toLowerCase().includes(filter));

  const handleSelect = (envId: string | null) => {
    onSwitch(envId);
    onClose();
  };

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      <div
        className="v5-tab-search-backdrop"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        role="presentation"
      />
      <div
        className="v5-env-dropdown"
        style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          zIndex: 1000,
          width: 300,
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          boxShadow: token.boxShadowSecondary,
          marginTop: 2,
        }}
      >
        {/* Search + actions bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            gap: 8,
          }}
        >
          <Input
            ref={inputRef}
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="borderless"
            size="small"
            style={{ flex: 1, fontSize: 12 }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          {onCreate && (
            <Tooltip title="New Environment" placement="bottom">
              <PlusOutlined
                style={{ fontSize: 12, color: token.colorTextSecondary, cursor: 'pointer', flexShrink: 0 }}
                onClick={() => {
                  onCreate();
                  onClose();
                }}
              />
            </Tooltip>
          )}
        </div>

        {/* Pin hint — only when in a collection context */}
        {canPin && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '8px 12px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <PushpinOutlined style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: token.colorTextTertiary, lineHeight: '16px' }}>
              Pin an environment to auto-switch when working in this collection
            </span>
          </div>
        )}

        {/* Environment list */}
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {/* No Environment */}
          <div
            className="v5-env-dropdown-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              background: !activeEnvironment ? token.colorBgTextHover : undefined,
            }}
            onClick={() => handleSelect(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSelect(null);
            }}
            role="button"
            tabIndex={0}
          >
            {!activeEnvironment ? (
              <CheckOutlined style={{ fontSize: 11, color: token.colorPrimary, flexShrink: 0 }} />
            ) : (
              <span style={{ width: 11, flexShrink: 0 }} />
            )}
            <span style={{ color: token.colorTextSecondary, fontStyle: 'italic' }}>No environment</span>
          </div>

          {/* Environments */}
          {filtered.map((env) => {
            const isActive = env.name === activeEnvironment;
            const isPinned = env.name === pinnedId;
            return (
              <div
                key={env.name}
                className="v5-env-dropdown-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  background: isActive ? token.colorBgTextHover : undefined,
                }}
                onClick={() => handleSelect(env.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelect(env.name);
                }}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {isActive ? (
                    <CheckOutlined style={{ fontSize: 11, color: token.colorPrimary, flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: 11, flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: token.colorText,
                    }}
                  >
                    {env.name}
                  </span>
                  {isPinned && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: token.colorTextTertiary,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 3,
                        padding: '0 4px',
                        lineHeight: '16px',
                        flexShrink: 0,
                      }}
                    >
                      DEFAULT
                    </span>
                  )}
                </div>
                {canPin && (
                  <Tooltip title={isPinned ? 'Unpin' : 'Set as default'} placement="left">
                    <PushpinOutlined
                      className="v5-env-hover-action"
                      style={{
                        fontSize: 12,
                        color: isPinned ? token.colorPrimary : token.colorTextQuaternary,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPin!(activeCollection!.uid, isPinned ? null : env.name);
                      }}
                    />
                  </Tooltip>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && environments.length > 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: token.colorTextTertiary }}>
              No matching environments
            </div>
          )}

          {environments.length === 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: token.colorTextTertiary }}>
              No environments created yet
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EnvSelector({
  token,
  environments,
  activeEnvironment,
  activeCollection,
  onSwitch,
  onPin,
  onCreate,
}: {
  token: ReturnType<typeof theme.useToken>['token'];
  environments: V5.Environment[];
  activeEnvironment: string | null;
  activeCollection: V5.Collection | null;
  onSwitch: (envName: string | null) => void;
  onPin?: (collectionId: string, envName: string | null) => void;
  onCreate?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const activeEnvName = activeEnvironment
    ? (environments.find((e) => e.name === activeEnvironment)?.name ?? 'Unknown')
    : 'No Environment';

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div
        className="v5-env-selector"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 8px',
          height: '100%',
          cursor: 'pointer',
          fontSize: 11,
          color: activeEnvironment ? token.colorText : token.colorTextTertiary,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setOpen((v) => !v);
        }}
        role="button"
        tabIndex={0}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: activeEnvironment ? '#52c41a' : token.colorTextQuaternary,
          }}
        >
          E
        </span>
        {activeEnvName}
        <DownOutlined style={{ fontSize: 8, color: token.colorTextTertiary }} />
      </div>
      <EnvSelectorDropdown
        open={open}
        onClose={() => setOpen(false)}
        environments={environments}
        activeEnvironment={activeEnvironment}
        activeCollection={activeCollection}
        onSwitch={onSwitch}
        onPin={onPin}
        onCreate={onCreate}
      />
    </div>
  );
}

// ── TabBar ──────────────────────────────────────────────────────

export function TabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onReorder,
  onCloseOther,
  onCloseAll,
  onCloseUnmodified,
  onCloseToLeft,
  onCloseToRight,
  onNewRequest,
  onNewRule,
  environments,
  activeEnvironment,
  onSwitchEnvironment,
  activeCollection,
  onPinEnvironment,
  onNewEnvironment,
  onNewDraftEnvironment,
  onToggleInspector,
  recentlyClosed,
  onReopenTab,
}: TabBarProps) {
  const { token } = theme.useToken();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const dragSideRef = useRef<'left' | 'right' | null>(null);
  dragSideRef.current = dragSide;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabSearchOpen, setTabSearchOpen] = useState(false);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return;
    const container = scrollRef.current;
    const activeEl = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  // Horizontal wheel scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // ⇧⌘A hotkey for tab search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setTabSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    dragSourceRef.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceRef.current === tabId) {
      setDragOverId(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    setDragOverId(tabId);
    setDragSide(e.clientX < midX ? 'left' : 'right');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, tabId: string) => {
      e.preventDefault();
      if (dragSourceRef.current && dragSourceRef.current !== tabId) {
        onReorder(dragSourceRef.current, tabId, dragSideRef.current || 'right');
      }
      dragSourceRef.current = null;
      setDragOverId(null);
      setDragSide(null);
    },
    [onReorder],
  );

  const handleDragEnd = useCallback(() => {
    dragSourceRef.current = null;
    setDragOverId(null);
    setDragSide(null);
  }, []);

  const buildContextMenu = useCallback(
    (tab: ResolvedTab, tabIndex: number) => ({
      items: [
        {
          key: 'close',
          label: 'Close',
          onClick: () => onClose(tab.id),
          disabled: tab.pinned,
        },
        {
          key: 'close-others',
          label: 'Close Other Tabs',
          onClick: () => onCloseOther(tab.id),
          disabled: tabs.length <= 1,
        },
        {
          key: 'close-all',
          label: 'Close All Tabs',
          onClick: () => onCloseAll(),
        },
        {
          key: 'close-unmodified',
          label: 'Close Unmodified Tabs',
          onClick: () => onCloseUnmodified(),
        },
        { type: 'divider' as const, key: 'd1' },
        {
          key: 'close-left',
          label: 'Close Tabs to the Left',
          onClick: () => onCloseToLeft(tab.id),
          disabled: tabIndex === 0,
        },
        {
          key: 'close-right',
          label: 'Close Tabs to the Right',
          onClick: () => onCloseToRight(tab.id),
          disabled: tabIndex === tabs.length - 1,
        },
      ],
    }),
    [tabs, onClose, onCloseOther, onCloseAll, onCloseUnmodified, onCloseToLeft, onCloseToRight],
  );

  const createMenuItems = [
    { key: 'request', icon: <ApiOutlined />, label: 'New Request', onClick: onNewRequest },
    { key: 'rule', icon: <ThunderboltOutlined />, label: 'New Rule', onClick: onNewRule },
    { key: 'environment', icon: <GlobalOutlined />, label: 'New Environment', onClick: onNewDraftEnvironment },
  ];

  return (
    <div
      className="v5-tabs-bar"
      style={{
        background: token.colorBgLayout,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="v5-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isDragOver = dragOverId === tab.id;
          const dropIndicatorStyle: React.CSSProperties | undefined =
            isDragOver && dragSide
              ? { [dragSide === 'left' ? 'borderLeft' : 'borderRight']: `2px solid ${token.colorPrimary}` }
              : undefined;

          return (
            <Tooltip
              key={tab.id}
              placement="bottom"
              mouseEnterDelay={0.5}
              title={
                tab.resolvedTooltip.includes('\n') ? (
                  <span style={{ whiteSpace: 'pre-line', fontSize: 11 }}>{tab.resolvedTooltip}</span>
                ) : (
                  tab.resolvedTooltip
                )
              }
            >
              <Dropdown menu={buildContextMenu(tab, index)} trigger={['contextMenu']}>
                <div
                  className={`v5-tab${isActive ? ' active' : ''}`}
                  data-tab-id={tab.id}
                  style={{
                    color: isActive ? token.colorText : token.colorTextSecondary,
                    borderBottomColor: isActive ? token.colorPrimary : 'transparent',
                    background: isActive ? token.colorBgContainer : undefined,
                    ...dropIndicatorStyle,
                  }}
                  onClick={() => onSwitch(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSwitch(tab.id);
                  }}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tab.id)}
                  onDragOver={(e) => handleDragOver(e, tab.id)}
                  onDrop={(e) => handleDrop(e, tab.id)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => {
                    if (dragOverId === tab.id) setDragOverId(null);
                  }}
                >
                  <TabIcon tab={tab} />
                  <span className="v5-tab-label" style={tab.draft ? { fontStyle: 'italic' } : undefined}>
                    {truncateMiddle(tab.resolvedLabel, TAB_LABEL_MAX)}
                  </span>
                  {(tab.unsaved || tab.draft) && (
                    <span className="v5-tab-unsaved" style={{ background: tab.draft ? '#7c3aed' : '#ff7875' }} />
                  )}
                  {!tab.pinned && (
                    <CloseOutlined
                      className="v5-tab-close"
                      style={{ fontSize: 10, color: token.colorTextTertiary }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose(tab.id);
                      }}
                    />
                  )}
                </div>
              </Dropdown>
            </Tooltip>
          );
        })}

        {/* + button — inside scroll area, right after last tab */}
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <div className="v5-tab-action" style={{ color: token.colorTextSecondary, flexShrink: 0 }}>
            <PlusOutlined style={{ fontSize: 12 }} />
          </div>
        </Dropdown>
      </div>

      {/* Tab search/select chevron + dropdown */}
      <div style={{ position: 'relative' }}>
        <div
          className="v5-tab-action"
          style={{ color: token.colorTextSecondary }}
          onClick={() => setTabSearchOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setTabSearchOpen((v) => !v);
          }}
          role="button"
          tabIndex={0}
        >
          <DownOutlined style={{ fontSize: 10 }} />
        </div>
        <TabSearchDropdown
          open={tabSearchOpen}
          onClose={() => setTabSearchOpen(false)}
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={onSwitch}
          recentlyClosed={recentlyClosed ?? []}
          onReopen={onReopenTab ?? (() => {})}
        />
      </div>

      {/* Divider before env selector */}
      {environments && (
        <div
          style={{
            width: 1,
            height: 16,
            background: token.colorTextQuaternary,
            flexShrink: 0,
            margin: '0 4px',
          }}
        />
      )}

      {/* Environment selector — right-aligned, always visible */}
      {environments && onSwitchEnvironment && (
        <EnvSelector
          token={token}
          environments={environments}
          activeEnvironment={activeEnvironment ?? null}
          activeCollection={activeCollection ?? null}
          onSwitch={onSwitchEnvironment}
          onPin={onPinEnvironment}
          onCreate={onNewEnvironment}
        />
      )}

      {/* Divider before variables toggle */}
      {onToggleInspector && (
        <div
          style={{
            width: 1,
            height: 16,
            background: token.colorTextQuaternary,
            flexShrink: 0,
            margin: '0 4px',
          }}
        />
      )}

      {/* Variables panel toggle */}
      {onToggleInspector && (
        <Tooltip title="Toggle Variables" placement="bottomRight">
          <div
            className="v5-tab-action"
            style={{ color: token.colorTextSecondary }}
            onClick={onToggleInspector}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onToggleInspector();
            }}
            role="button"
            tabIndex={0}
          >
            <UnorderedListOutlined style={{ fontSize: 12 }} />
          </div>
        </Tooltip>
      )}
    </div>
  );
}
