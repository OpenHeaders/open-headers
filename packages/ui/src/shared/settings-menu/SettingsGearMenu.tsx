/**
 * SettingsGearMenu — the topbar gear opens a small popover menu
 * (Settings, Keyboard, Appearance, About) instead of jumping straight
 * into the settings surface.
 *
 * Update affordance: hosts that own their update story register the
 * `getAppUpdate` capability (desktop app); when it reports a newer
 * build, a "Download …" item leads the menu and the gear carries an
 * attention dot. Opening the menu acknowledges the dot (persisted per
 * version), the item stays until the user updates. Below the published
 * security floor the dot turns red and ignores the ack.
 *
 * Type-to-search: typing while the menu is open swaps the header to a
 * search field and filters the items live — Esc clears back to the
 * full menu, arrows + Enter drive selection.
 */

import {
  CompassOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { getHostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { Button, Input, type InputRef, Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { readIgnoredVersion } from '../updates/release-notes';

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

/** The pending-update slice the menu renders — version plus how far along it is. */
interface PendingUpdate {
  version: string;
  url?: string;
  phase: 'available' | 'downloading' | 'downloaded';
  /** Below the published security floor — red badge, ack ignored. */
  security: boolean;
  /**
   * The package manager owns the install (deb/rpm): the item announces
   * the version and `url` opens the release notes instead of a
   * download page.
   */
  external?: boolean;
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
  /** Surfaces with an onboarding tour add a replay item; omit to hide. */
  onOpenTour?: () => void;
}

const SettingsGearMenu: React.FC<SettingsGearMenuProps> = ({ onOpenSettings, openSettingsLabel, onOpenTour }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [update, setUpdate] = useState<PendingUpdate | null>(null);
  const [acked, setAcked] = useState<string | null>(() => readAck());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    const probe = getCapability('getAppUpdate');
    if (!probe) return;
    let cancelled = false;
    const applyState = (state: {
      phase: string;
      availableVersion: string | null;
      releaseNotesUrl?: string | null;
      belowSafeFloor?: boolean;
      installMethod?: 'builtin' | 'packageManager';
    }): void => {
      const { phase } = state;
      if ((phase === 'available' || phase === 'downloading' || phase === 'downloaded') && state.availableVersion) {
        // Package-manager installs reuse the URL-item mechanics: the
        // entry opens the release notes, never a download/install verb.
        const external = state.installMethod === 'packageManager';
        setUpdate({
          version: state.availableVersion,
          phase,
          security: state.belowSafeFloor === true,
          ...(external ? { url: state.releaseNotesUrl ?? undefined, external } : {}),
        });
      } else {
        setUpdate(null);
      }
    };
    const bridge = getHostBridge();
    if (bridge) {
      // In-app updater host: hydrate phase-accurately — the capability
      // probe collapses downloading/downloaded into "available", which
      // would mislabel the item when the menu mounts mid-download.
      void bridge
        .call('oh.updates.getState')
        .then((state) => {
          if (!cancelled) applyState(state);
        })
        .catch(() => {
          // Host without the updater RPC — fall back to the probe.
          void probe().then((info) => {
            if (!cancelled) setUpdate(info ? { ...info, phase: 'available', security: false } : null);
          });
        });
    } else {
      // URL-reporting host: pending-but-not-installed is by definition
      // the 'available' phase.
      void probe().then((info) => {
        if (!cancelled) setUpdate(info ? { ...info, phase: 'available', security: false } : null);
      });
    }
    // Live transitions light the dot and advance the item label
    // (download → restart) without a remount.
    const unsubscribe = bridge?.subscribe('appUpdateState', (state) => applyState(state));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // A security-floor update ignores the ack — the red badge keeps
  // asking until the user actually updates. An explicitly ignored
  // version never lights the dot (unless it's below the floor).
  const showDot =
    update !== null && (update.security || (acked !== update.version && readIgnoredVersion() !== update.version));

  const groups = useMemo<MenuItem[][]>(() => {
    const close = () => setOpen(false);
    const out: MenuItem[][] = [];
    if (update) {
      // Version-only labels — the popover is narrow and the product
      // name adds nothing the surrounding chrome doesn't already say.
      const byPhase = {
        // A URL-reporting host's item opens a download page, a
        // package-manager install's opens the release notes — only the
        // in-app updater can promise the one-click restart.
        available: update.url
          ? {
              label: t(
                update.external ? 'shared.chrome.gearMenu.versionAvailable' : 'shared.chrome.gearMenu.downloadVersion',
                { version: update.version },
              ),
              icon: update.external ? <InfoCircleOutlined /> : <DownloadOutlined />,
            }
          : {
              label: t('shared.chrome.gearMenu.updateAndRestartVersion', { version: update.version }),
              icon: <ReloadOutlined />,
            },
        downloading: {
          label: t('shared.chrome.gearMenu.downloadingVersion', { version: update.version }),
          icon: <SyncOutlined spin />,
        },
        downloaded: {
          label: t('shared.chrome.gearMenu.restartToInstallVersion', { version: update.version }),
          icon: <ReloadOutlined />,
        },
      } as const;
      out.push([
        {
          key: 'update',
          label: byPhase[update.phase].label,
          icon: byPhase[update.phase].icon,
          accent: true,
          run: () => {
            close();
            if (update.url) {
              const openUrl = getCapability('openExternalUrl');
              if (openUrl) void openUrl(update.url);
              else window.open(update.url, '_blank', 'noopener');
              return;
            }
            // In-app updater host — each phase's item does exactly what
            // it says, same as the native menu items.
            const bridge = getHostBridge();
            if (update.phase === 'available') void bridge?.call('oh.updates.updateAndRestart');
            else if (update.phase === 'downloaded') void bridge?.call('oh.updates.install');
          },
        },
      ]);
    }
    out.push([
      {
        key: 'settings',
        label: t('shared.chrome.gearMenu.settings'),
        icon: <SettingOutlined />,
        hint: openSettingsLabel ?? undefined,
        run: () => {
          close();
          onOpenSettings();
        },
      },
      {
        key: 'keyboard',
        label: t('shared.chrome.gearMenu.keyboardShortcuts'),
        run: () => {
          close();
          onOpenSettings({ categoryId: 'keyboard' });
        },
      },
      {
        key: 'appearance',
        label: t('shared.chrome.gearMenu.appearance'),
        run: () => {
          close();
          onOpenSettings({ categoryId: 'appearance' });
        },
      },
    ]);
    if (onOpenTour) {
      out.push([
        {
          key: 'tour',
          label: t('shared.chrome.gearMenu.tourGuide'),
          icon: <CompassOutlined />,
          run: () => {
            close();
            onOpenTour();
          },
        },
      ]);
    }
    out.push([
      {
        key: 'about',
        label: t('shared.chrome.gearMenu.about'),
        run: () => {
          close();
          onOpenSettings({ categoryId: 'about' });
        },
      },
    ]);
    // Web host only: a served daemon session the tab can drop on its own.
    const signOut = getCapability('signOut');
    if (signOut) {
      out.push([
        {
          key: 'signout',
          label: t('shared.chrome.gearMenu.signOut'),
          icon: <LogoutOutlined />,
          run: () => {
            close();
            signOut();
          },
        },
      ]);
    }
    return out;
  }, [update, onOpenSettings, openSettingsLabel, onOpenTour, t]);

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
          color: item.accent ? token.colorPrimaryText : token.colorText,
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
            color: item.accent ? token.colorPrimary : token.colorTextSecondary,
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
          placeholder={t('shared.chrome.gearMenu.searchPlaceholder')}
          style={{ marginBottom: 6 }}
        />
      )}
      {trimmed ? (
        visible.length > 0 ? (
          visible.map(renderItem)
        ) : (
          <div style={{ padding: '10px 10px', fontSize: 12, color: token.colorTextTertiary }}>
            {t('shared.chrome.gearMenu.noMatches')}
          </div>
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
      {/* Force-hide the tooltip while the menu is open — otherwise both
          popups stack under the gear. */}
      <Tooltip title={t('shared.chrome.gearMenu.settingsTooltip')} placement="bottomRight" open={open ? false : undefined}>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <Button size="small" type="text" icon={<SettingOutlined />} aria-label={t('shared.chrome.gearMenu.settingsMenuAria')} />
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
                background: update?.security ? token.colorError : token.colorPrimary,
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
