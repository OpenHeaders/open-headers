/**
 * SettingsGearMenu — the topbar gear opens a small popover menu
 * (Settings, Keyboard, Appearance, About) instead of jumping straight
 * into the settings surface.
 *
 * Update affordance: hosts that own their update story register the
 * `getAppUpdate` capability (desktop app); when it reports a newer
 * build, a "Download …" item leads the menu and the gear carries an
 * attention dot. Opening the menu acknowledges the dot (persisted per
 * version), the item stays until the user updates.
 *
 * Type-to-search: typing while the menu is open swaps the header to a
 * search field and filters the items live — Esc clears back to the
 * full menu, arrows + Enter drive selection.
 */

import { DownloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import type { AppUpdateInfo } from '@openheaders/core/capabilities';
import { Button, Input, type InputRef, Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

const UPDATE_ACK_KEY = 'oh.gearUpdateAck';

function readAck(): string | null {
  try {
    return window.localStorage.getItem(UPDATE_ACK_KEY);
  } catch {
    return null;
  }
}

function writeAck(version: string): void {
  try {
    window.localStorage.setItem(UPDATE_ACK_KEY, version);
  } catch {
    // Storage unavailable — the dot simply reappears next session.
  }
}

interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** Right-aligned hint (shortcut label). */
  hint?: string;
  /** Tinted accent item (the update entry). */
  accent?: boolean;
  run: () => void;
}

interface SettingsGearMenuProps {
  onOpenSettings: (target?: { settingKey?: string; categoryId?: string }) => void;
  /** Shortcut hint for the Settings item (from useShortcutLabel). */
  openSettingsLabel?: string | null;
}

const SettingsGearMenu: React.FC<SettingsGearMenuProps> = ({ onOpenSettings, openSettingsLabel }) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [acked, setAcked] = useState<string | null>(() => readAck());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    const probe = getCapability('getAppUpdate');
    if (!probe) return;
    let cancelled = false;
    void probe().then((info) => {
      if (!cancelled) setUpdate(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showDot = update !== null && acked !== update.version;

  const groups = useMemo<MenuItem[][]>(() => {
    const close = () => setOpen(false);
    const out: MenuItem[][] = [];
    if (update) {
      out.push([
        {
          key: 'update',
          label: `Download Open Headers ${update.version}`,
          icon: <DownloadOutlined />,
          accent: true,
          run: () => {
            close();
            const openUrl = getCapability('openExternalUrl');
            if (openUrl) void openUrl(update.url);
            else window.open(update.url, '_blank', 'noopener');
          },
        },
      ]);
    }
    out.push([
      {
        key: 'settings',
        label: 'Settings…',
        icon: <SettingOutlined />,
        hint: openSettingsLabel ?? undefined,
        run: () => {
          close();
          onOpenSettings();
        },
      },
      {
        key: 'keyboard',
        label: 'Keyboard Shortcuts…',
        run: () => {
          close();
          onOpenSettings({ categoryId: 'keyboard' });
        },
      },
      {
        key: 'appearance',
        label: 'Appearance…',
        run: () => {
          close();
          onOpenSettings({ categoryId: 'appearance' });
        },
      },
    ]);
    out.push([
      {
        key: 'about',
        label: 'About Open Headers',
        run: () => {
          close();
          onOpenSettings({ categoryId: 'about' });
        },
      },
    ]);
    return out;
  }, [update, onOpenSettings, openSettingsLabel]);

  const flat = useMemo(() => groups.flat(), [groups]);
  const trimmed = query.trim().toLowerCase();
  const visible = useMemo(
    () => (trimmed ? flat.filter((item) => item.label.toLowerCase().includes(trimmed)) : flat),
    [flat, trimmed],
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setQuery('');
    setSearching(false);
    setActiveIndex(0);
    if (next && update) {
      writeAck(update.version);
      setAcked(update.version);
    }
    if (next) {
      window.requestAnimationFrame(() => listRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (searching) {
        setQuery('');
        setSearching(false);
        setActiveIndex(0);
        window.requestAnimationFrame(() => listRef.current?.focus());
      } else {
        setOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (visible.length === 0) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => (i + delta + visible.length) % visible.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      visible[activeIndex]?.run();
      return;
    }
    // Any printable character flips the menu into search mode.
    if (!searching && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setSearching(true);
      setQuery(e.key);
      setActiveIndex(0);
      window.requestAnimationFrame(() => inputRef.current?.focus({ cursor: 'end' }));
    }
  };

  const renderItem = (item: MenuItem) => {
    const idx = visible.indexOf(item);
    const active = idx === activeIndex;
    return (
      <button
        key={item.key}
        type="button"
        onClick={item.run}
        onMouseEnter={() => setActiveIndex(idx)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '5px 10px',
          border: 'none',
          borderRadius: 5,
          background: active ? token.colorBgTextHover : 'transparent',
          color: item.accent ? token.colorWarningText : token.colorText,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 13,
        }}
      >
        <span
          style={{
            width: 16,
            display: 'inline-flex',
            justifyContent: 'center',
            flex: 'none',
            color: item.accent ? token.colorWarning : token.colorTextSecondary,
          }}
        >
          {item.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </span>
        {item.hint && <span style={{ fontSize: 11, color: token.colorTextTertiary, flex: 'none' }}>{item.hint}</span>}
      </button>
    );
  };

  const content = (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: the menu container owns keyboard navigation
    <div ref={listRef} tabIndex={-1} onKeyDown={handleKeyDown} style={{ width: 250, outline: 'none' }}>
      {searching && (
        <Input
          ref={inputRef}
          size="small"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          placeholder="Search"
          style={{ marginBottom: 6 }}
        />
      )}
      {trimmed ? (
        visible.length > 0 ? (
          visible.map(renderItem)
        ) : (
          <div style={{ padding: '10px 10px', fontSize: 12, color: token.colorTextTertiary }}>No matches</div>
        )
      ) : (
        groups.map((group, gi) => (
          <div key={group[0]?.key ?? gi}>
            {gi > 0 && (
              <div style={{ height: 1, background: token.colorBorderSecondary, margin: '5px 4px' }} />
            )}
            {group.map(renderItem)}
          </div>
        ))
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      open={open}
      onOpenChange={handleOpenChange}
      trigger={['click']}
      placement="bottomRight"
      arrow={false}
      overlayInnerStyle={{ padding: 6 }}
    >
      <Tooltip title="Settings" placement="bottomRight">
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <Button size="small" type="text" icon={<SettingOutlined />} aria-label="Settings menu" />
          {showDot && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 1,
                right: 1,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: token.colorWarning,
                border: `1px solid ${token.colorBgContainer}`,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </Tooltip>
    </Popover>
  );
};

export default SettingsGearMenu;
