/**
 * CommandPalette — modal overlay for search + commands (⌘K).
 *
 * Drill model follows SaveToCollectionModal: simple state swap via drillGroupId.
 * Keyboard nav follows Sidebar: focusedId (string), imperative scrollToId.
 * Entries derived directly on render — no stale state, no effects fighting.
 */

import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';
import { Input, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';

// ── Public types ──────────────────────────────────────────────────

export interface CommandPaletteItem {
  id: string;
  icon?: React.ReactNode;
  label: string;
  scope?: string;
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandPaletteSection {
  id: string;
  title: string;
  items: CommandPaletteItem[];
}

export interface CommandPaletteGroup {
  id: string;
  icon?: React.ReactNode;
  label: string;
  children: CommandPaletteSection[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups?: CommandPaletteGroup[];
  sections?: CommandPaletteSection[];
}

// ── Row model (flat list for rendering + keyboard nav) ────────────

type Row =
  | { kind: 'divider'; id: string; title: string }
  | { kind: 'group'; id: string; icon?: React.ReactNode; label: string; group: CommandPaletteGroup }
  | { kind: 'item'; id: string; item: CommandPaletteItem };

function matchItem(item: CommandPaletteItem, q: string): boolean {
  return item.label.toLowerCase().includes(q) || (item.scope?.toLowerCase().includes(q) ?? false);
}

// ── Component ─────────────────────────────────────────────────────

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, groups = [], sections = [] }) => {
  const { token } = theme.useToken();
  const t = useT();
  const commandPaletteLabel = useShortcutLabel('command-palette');
  const inputRef = useRef<InputRef>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [drillGroupId, setDrillGroupId] = useState<string | null>(null);
  // Remember which group was focused before drilling, so we restore on back
  const prevFocusedRef = useRef<string | null>(null);

  const drillGroup = drillGroupId ? (groups.find((g) => g.id === drillGroupId) ?? null) : null;

  // ── Derive rows on every render (no stale state) ──────────────

  const q = query.toLowerCase();
  const rows: Row[] = [];

  if (drillGroup) {
    for (const section of drillGroup.children) {
      const filtered = q ? section.items.filter((it) => matchItem(it, q)) : section.items;
      if (filtered.length === 0) continue;
      rows.push({ kind: 'divider', id: `div-${section.id}`, title: section.title });
      for (const item of filtered) rows.push({ kind: 'item', id: item.id, item });
    }
  } else {
    if (groups.length > 0) {
      const filtered = q
        ? groups.filter(
            (g) => g.label.toLowerCase().includes(q) || g.children.some((s) => s.items.some((it) => matchItem(it, q))),
          )
        : groups;
      if (filtered.length > 0) {
        rows.push({ kind: 'divider', id: 'div-collections', title: t('workbench.shell.commandPalette.collectionsDivider') });
        for (const g of filtered) rows.push({ kind: 'group', id: g.id, icon: g.icon, label: g.label, group: g });
      }
    }
    for (const section of sections) {
      const filtered = q ? section.items.filter((it) => matchItem(it, q)) : section.items;
      if (filtered.length === 0) continue;
      rows.push({ kind: 'divider', id: `div-${section.id}`, title: section.title });
      for (const item of filtered) rows.push({ kind: 'item', id: item.id, item });
    }
  }

  const selectable = rows.filter((r): r is Row & { kind: 'group' | 'item' } => r.kind !== 'divider');

  // Clamp focusedId: if current focus is not in selectable, snap to first
  const focusValid = focusedId != null && selectable.some((r) => r.id === focusedId);
  const effectiveFocusId = focusValid ? focusedId : (selectable[0]?.id ?? null);

  // ── Reset on open ─────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setQuery('');
      setFocusedId(null);
      setDrillGroupId(null);
      prevFocusedRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Close on Escape ───────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Imperative scroll (same as Sidebar) ───────────────────────

  const scrollToId = useCallback((id: string) => {
    setTimeout(() => {
      resultsRef.current?.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }, []);

  // ── Drill in / back ──────────────────────────────────────────

  const drillInto = useCallback((group: CommandPaletteGroup) => {
    prevFocusedRef.current = group.id;
    setDrillGroupId(group.id);
    setQuery('');
    setFocusedId(null); // will snap to first via effectiveFocusId
  }, []);

  const drillBack = useCallback(() => {
    setDrillGroupId(null);
    setQuery('');
    // Restore focus to the group we drilled into
    setFocusedId(prevFocusedRef.current);
    if (prevFocusedRef.current) scrollToId(prevFocusedRef.current);
    prevFocusedRef.current = null;
  }, [scrollToId]);

  // ── Keyboard handler ─────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (selectable.length === 0) return;
        e.preventDefault();
        const cur = selectable.findIndex((r) => r.id === effectiveFocusId);
        const next =
          e.key === 'ArrowDown'
            ? cur < selectable.length - 1
              ? cur + 1
              : 0
            : cur > 0
              ? cur - 1
              : selectable.length - 1;
        const row = selectable[next];
        setFocusedId(row.id);
        scrollToId(row.id);
        return;
      }

      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        const row = selectable.find((r) => r.id === effectiveFocusId);
        if (!row) return;
        if (row.kind === 'group') {
          e.preventDefault();
          drillInto(row.group);
        } else if (row.kind === 'item' && e.key === 'Enter') {
          e.preventDefault();
          row.item.onSelect();
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowLeft' || (e.key === 'Backspace' && query === '')) {
        if (drillGroupId) {
          e.preventDefault();
          drillBack();
        }
      }
    },
    [selectable, effectiveFocusId, scrollToId, drillInto, drillBack, query, drillGroupId, onClose],
  );

  if (!open) return null;

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is standard modal UX */}
      <div className="rules-cmd-backdrop" onClick={onClose} onKeyDown={() => {}} role="presentation" />

      <div
        className="rules-cmd-palette"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        {drillGroup && (
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled by input onKeyDown
          // biome-ignore lint/a11y/noStaticElementInteractions: breadcrumb back button
          <div
            className="rules-cmd-breadcrumb"
            style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextTertiary }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={drillBack}
          >
            <LeftOutlined style={{ fontSize: 10 }} />
            <span>{drillGroup.label}</span>
          </div>
        )}

        <Input
          ref={inputRef}
          className="rules-cmd-input"
          placeholder={
            drillGroup
              ? t('workbench.shell.commandPalette.searchInGroup', { name: drillGroup.label })
              : t('workbench.shell.commandPalette.placeholder')
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocusedId(null); // snap to first via effectiveFocusId
          }}
          onKeyDown={handleKeyDown}
          variant="borderless"
          size="large"
          style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, borderRadius: 0 }}
        />

        {/* Keep the search input focused through mouse interactions —
            keyboard nav lives on the input's onKeyDown, so a click that
            steals focus (e.g. drilling into a group) would kill arrow keys */}
        <div ref={resultsRef} className="rules-cmd-results" onMouseDown={(e) => e.preventDefault()}>
          {selectable.length === 0 && (
            <div className="rules-cmd-empty" style={{ color: token.colorTextTertiary }}>
              {query ? t('workbench.shell.commandPalette.noResults') : t('workbench.shell.commandPalette.emptyHint')}
            </div>
          )}
          {rows.map((row, i) => {
            if (row.kind === 'divider') {
              return (
                <div
                  key={row.id}
                  className="rules-cmd-divider"
                  style={{
                    color: token.colorTextTertiary,
                    borderTop: i > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
                  }}
                >
                  {row.title}
                </div>
              );
            }

            const isFocused = row.id === effectiveFocusId;

            if (row.kind === 'group') {
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled by parent input onKeyDown
                <div
                  key={row.id}
                  data-item-id={row.id}
                  className={`rules-cmd-result ${isFocused ? 'selected' : ''}`}
                  style={isFocused ? { background: token.colorPrimaryBg } : undefined}
                  onClick={() => drillInto(row.group)}
                  onMouseEnter={() => setFocusedId(row.id)}
                  role="option"
                  aria-selected={isFocused}
                  tabIndex={-1}
                >
                  {row.icon && <span className="rules-cmd-result-icon">{row.icon}</span>}
                  <span className="rules-cmd-result-label">{row.label}</span>
                  <RightOutlined
                    style={{ fontSize: 10, color: token.colorTextQuaternary, flexShrink: 0, marginLeft: 'auto' }}
                  />
                </div>
              );
            }

            const { item } = row;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled by parent input onKeyDown
              <div
                key={item.id}
                data-item-id={item.id}
                className={`rules-cmd-result ${isFocused ? 'selected' : ''}`}
                style={isFocused ? { background: token.colorPrimaryBg } : undefined}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
                onMouseEnter={() => setFocusedId(item.id)}
                role="option"
                aria-selected={isFocused}
                tabIndex={-1}
              >
                {item.icon && <span className="rules-cmd-result-icon">{item.icon}</span>}
                <span className="rules-cmd-result-label">{item.label}</span>
                {item.scope && (
                  <span className="rules-cmd-result-scope" style={{ color: token.colorTextTertiary }}>
                    {item.scope}
                  </span>
                )}
                {item.shortcut && (
                  <span
                    className="rules-cmd-result-shortcut"
                    style={{ background: token.colorBgElevated, color: token.colorTextTertiary }}
                  >
                    {item.shortcut}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="rules-cmd-footer"
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextTertiary }}
        >
          <span>{t('workbench.shell.commandPalette.footer.navigate')}</span>
          {drillGroupId ? (
            <span>{t('workbench.shell.commandPalette.footer.back')}</span>
          ) : (
            <span>{t('workbench.shell.commandPalette.footer.open')}</span>
          )}
          <span>{t('workbench.shell.commandPalette.footer.select')}</span>
          <span>{t('workbench.shell.commandPalette.footer.close')}</span>
          <span style={{ marginLeft: 'auto' }}>{commandPaletteLabel}</span>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
