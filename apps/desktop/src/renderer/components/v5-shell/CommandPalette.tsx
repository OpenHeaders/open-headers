/**
 * CommandPalette — modal overlay for search + commands (⌘K).
 *
 * Two modes:
 * - Search mode (default): fuzzy search across all entities
 * - Command mode (type >): shows available actions with shortcuts
 */

import type { InputRef } from 'antd';
import { Input, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

interface CommandPaletteItem {
  id: string;
  icon?: React.ReactNode;
  label: string;
  scope?: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items?: CommandPaletteItem[];
}

export function CommandPalette({ open, onClose, items = [] }: CommandPaletteProps) {
  const { token } = theme.useToken();
  const inputRef = useRef<InputRef>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Filter items
  const isCommandMode = query.startsWith('>');
  const searchQuery = isCommandMode ? query.slice(1).trim() : query.trim();
  const filteredItems = searchQuery
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.scope?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : items;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].onSelect();
          onClose();
        }
      }
    },
    [filteredItems, selectedIndex, onClose],
  );

  if (!open) return null;

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is standard modal UX */}
      <div className="v5-cmd-backdrop" onClick={onClose} onKeyDown={() => {}} role="presentation" />

      {/* Palette */}
      <div
        className="v5-cmd-palette"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        <Input
          ref={inputRef}
          className="v5-cmd-input"
          placeholder="Search collections, rules, variables, or type > for commands..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          variant="borderless"
          size="large"
          style={{
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 0,
          }}
        />

        <div className="v5-cmd-results">
          {filteredItems.length === 0 && (
            <div className="v5-cmd-empty" style={{ color: token.colorTextTertiary }}>
              {query ? 'No results found' : 'Type to search or > for commands'}
            </div>
          )}
          {filteredItems.map((item, i) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled by parent input onKeyDown
            <div
              key={item.id}
              className={`v5-cmd-result ${i === selectedIndex ? 'selected' : ''}`}
              style={i === selectedIndex ? { background: token.colorPrimaryBg } : undefined}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              role="option"
              aria-selected={i === selectedIndex}
              tabIndex={-1}
            >
              {item.icon && <span className="v5-cmd-result-icon">{item.icon}</span>}
              <span className="v5-cmd-result-label">{item.label}</span>
              {item.scope && (
                <span className="v5-cmd-result-scope" style={{ color: token.colorTextTertiary }}>
                  {item.scope}
                </span>
              )}
              {item.shortcut && (
                <span
                  className="v5-cmd-result-shortcut"
                  style={{ background: token.colorBgElevated, color: token.colorTextTertiary }}
                >
                  {item.shortcut}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
