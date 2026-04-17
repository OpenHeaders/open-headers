/**
 * Command-palette style "Add Rule" picker.
 *
 * Replaces a cascading Dropdown menu (rule type → templates) that didn't
 * fit at sidepanel widths. A single searchable list works at any width:
 * one column, keyboard-first, type to filter across rule types AND
 * templates simultaneously.
 *
 * Each leaf is selectable on its own — "Blank rule" entries open the
 * editor at `/create/<type>` and template entries open at
 * `/create/<type>/<templateKey>`.
 */

import { CodeOutlined, SearchOutlined } from '@ant-design/icons';
import { Empty, Input, Modal, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES_BY_TYPE } from '@/rules/rule-templates';
import { ALL_RULE_TYPES } from '@/rules/rule-type-menu';

const { Text } = Typography;

interface PaletteItem {
  id: string;
  ruleType: string;
  templateKey?: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  group: string;
  groupIcon: React.ReactNode;
}

function buildPaletteItems(): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const t of ALL_RULE_TYPES) {
    items.push({
      id: `${t.key}-blank`,
      ruleType: t.key,
      title: 'Blank rule',
      subtitle: t.description,
      icon: <CodeOutlined style={{ opacity: 0.55 }} />,
      group: t.label,
      groupIcon: t.icon,
    });
    for (const tpl of TEMPLATES_BY_TYPE[t.key] ?? []) {
      items.push({
        id: `${t.key}-${tpl.key}`,
        ruleType: t.key,
        templateKey: tpl.key,
        title: tpl.name,
        subtitle: tpl.description,
        icon: <span style={{ fontSize: 14 }}>{tpl.icon}</span>,
        group: t.label,
        groupIcon: t.icon,
      });
    }
  }
  return items;
}

interface AddRulePaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (ruleType: string, templateKey?: string) => void;
}

export function AddRulePalette({ open, onClose, onSelect }: AddRulePaletteProps): React.ReactElement {
  const allItems = useMemo(buildPaletteItems, []);
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset query and focus when the modal opens, so a re-open always
  // starts from a clean slate. Avoids stale filter state surprising
  // the user on subsequent invocations.
  useEffect(() => {
    if (open) {
      setQuery('');
      setFocusIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (i) =>
        i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q) || i.group.toLowerCase().includes(q),
    );
  }, [allItems, query]);

  // Group items by their parent rule type so the list reads as
  // "Modify Headers / Blank, CORS Bypass, ..." rather than a flat 80-row
  // dump. Group order matches `ALL_RULE_TYPES` (definitive sort order).
  const grouped = useMemo(() => {
    const order = new Map<string, { groupIcon: React.ReactNode; items: PaletteItem[] }>();
    for (const t of ALL_RULE_TYPES) {
      order.set(t.label, { groupIcon: t.icon, items: [] });
    }
    for (const item of filtered) {
      order.get(item.group)?.items.push(item);
    }
    return [...order.entries()].filter(([, v]) => v.items.length > 0);
  }, [filtered]);

  // Clamp focusIndex when filter shrinks the list — otherwise an out-of-
  // range index would silently break Enter selection.
  useEffect(() => {
    if (focusIndex >= filtered.length) setFocusIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, focusIndex]);

  // Auto-scroll the focused row into view as the user arrows through
  // the list. `block: 'nearest'` avoids jumpy scrolls when the row is
  // already on screen.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-palette-index="${focusIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusIndex, open]);

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      onSelect(item.ruleType, item.templateKey);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[focusIndex];
        if (item) handleSelect(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, focusIndex, handleSelect, onClose],
  );

  // Map every item's id → its index in the flat list so grouped render
  // can resolve its focus state without recomputing the index per row.
  const flatIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < filtered.length; i++) map.set(filtered[i].id, i);
    return map;
  }, [filtered]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      closable={false}
      width={480}
      styles={{
        body: { padding: 0 },
        // Keep the modal tight to the top of the viewport so a tall
        // list doesn't push the input out of reach.
      }}
      style={{ top: 60 }}
      destroyOnHidden
      className="oh-add-rule-palette"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: command-palette wrapper captures arrow/enter/esc on the modal as a whole */}
      <div onKeyDown={handleKeyDown}>
        <Input
          autoFocus
          size="large"
          variant="borderless"
          placeholder="Search rule types and templates…"
          prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            borderBottom: '1px solid var(--ant-color-border-secondary)',
            borderRadius: 0,
            padding: '12px 16px',
          }}
        />
        <div ref={listRef} className="oh-palette-list">
          {grouped.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={`No matches for "${query}"`}
              style={{ padding: '32px 0' }}
            />
          ) : (
            grouped.map(([groupName, { groupIcon, items }]) => (
              <div key={groupName} className="oh-palette-group">
                <div className="oh-palette-group-header">
                  <span className="oh-palette-group-icon">{groupIcon}</span>
                  <span className="oh-palette-group-name">{groupName}</span>
                </div>
                {items.map((item, idx) => {
                  const flatIndex = flatIndexById.get(item.id) ?? -1;
                  const isFocused = flatIndex === focusIndex;
                  const isLast = idx === items.length - 1;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-palette-index={flatIndex}
                      className={`oh-palette-row${isFocused ? ' oh-palette-row-focused' : ''}`}
                      onMouseEnter={() => setFocusIndex(flatIndex)}
                      onClick={() => handleSelect(item)}
                    >
                      <span className="oh-palette-row-tree" aria-hidden="true">
                        {isLast ? '└─' : '├─'}
                      </span>
                      <span className="oh-palette-row-icon">{item.icon}</span>
                      <span className="oh-palette-row-text">
                        <span className="oh-palette-row-title">{item.title}</span>
                        {item.subtitle && (
                          <Text className="oh-palette-row-subtitle" type="secondary">
                            {item.subtitle}
                          </Text>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
