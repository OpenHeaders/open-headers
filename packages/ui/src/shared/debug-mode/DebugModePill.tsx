/**
 * DebugModePill — the standalone footer control for debug mode (the
 * browser's debugging protocol). Sits to the LEFT of the System Status
 * pill on every surface and opens its own popover on hover / click, mirroring
 * the System Status trigger.
 *
 * Named "Debug mode" because the browser shows a "<app> is debugging this
 * browser" banner on each attached tab — the control's label matches what the
 * user actually sees.
 *
 * The on/off switch sits inline in the footer (right of the dot + label);
 * the label + dot open the popover for scope + pin + roster, shown regardless
 * of on/off so the user can pick the scope and pin tabs BEFORE enabling.
 * Everything derives from canonical state (settings + the live SW attach
 * snapshot); nothing is cached locally:
 *   - master toggle  → `inspection.cdpEnabled` setting (title row).
 *   - scope dropdown → `inspection.cdpScope` setting.
 *   - attached roster → the live `cdp` Status entry's `context.tabs`, each row
 *     jumping to its tab through the host-agnostic peer-navigator seam.
 *   - "include this browser tab" pin → reflects `context.pinnedTabs` (carried
 *     even while off) and writes through the `setCdpTabPin` RPC. Shown only
 *     when the current tab isn't already covered by the scope (else it would
 *     be redundant).
 *
 * Capability-gated: where the browser lacks the `cdpInspection` capability
 * (Firefox / Safari) the control still renders, but disabled with a tooltip
 * pointing to Chrome / Edge so the feature stays discoverable. Non-browser
 * hosts (desktop) have nothing to debug and render nothing. Chrome-free — tab
 * id resolution, titles, and jump-to-tab all go through host seams, never
 * `chrome.*`.
 */

import { ExportOutlined, InfoCircleOutlined, PushpinFilled } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { hasCapability } from '@openheaders/core/capabilities';
import type { CdpRosterTab, CdpScopeMode } from '@openheaders/core/types';
import { readCdpPinnedTabs, readCdpRoster } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useChordLabel } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { useSetting, useSettingsReady } from '@openheaders/ui/workbench/settings/hooks';
import { Badge, Button, ConfigProvider, Popover, Select, Switch, Tooltip, Typography, theme } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import React from 'react';
import { isPeerNavigable, peerNavigate } from '../awareness/peer-navigate';
import { getCurrentHost } from '../host-vocabulary';
import { useStatus } from '../hooks/useStatus';
import type { StatusEntry } from '../status/types';
import { type DebugModeTabSource, useControlTabId } from './useControlTabId';
import { useDebugModeShortcut } from './useDebugModeShortcut';

/**
 * Docs anchor for the "Debug Mode" reference section. Surfaces that mount
 * the pill pass this through `onOpenDocs` (workspace `openDocs` hook, or the
 * popup/sidepanel `#/docs/<id>` route) when the popover's (i) button is
 * clicked — mirrors `STATUS_DOCS_SECTION_ID` on the System Status pill.
 */
export const DEBUG_DOCS_SECTION_ID = 'debug-mode';

const SCOPE_OPTIONS: { labelKey: MessageKey; value: CdpScopeMode }[] = [
  { labelKey: 'shared.chrome.debug.scopeDevtools', value: 'devtools' },
  { labelKey: 'shared.chrome.debug.scopeActive', value: 'active' },
  { labelKey: 'shared.chrome.debug.scopeBoth', value: 'both' },
];

/**
 * Whether the per-tab pin adds anything for this surface under the current
 * scope. The active tab is already covered by `active`/`both`; the inspected
 * (DevTools) tab is already covered by `devtools`/`both`. The pin is only
 * non-redundant in the remaining case for each surface — a pinned tab is
 * always offered (so it can be un-pinned) via the caller's `|| pinned` guard.
 */
function pinAddsValue(tabSource: DebugModeTabSource, scope: CdpScopeMode): boolean {
  if (tabSource === 'none') return false;
  if (tabSource === 'active') return scope === 'devtools';
  return scope === 'active';
}

export interface DebugModePillProps {
  tabSource: DebugModeTabSource;
  /** Footer pill hit-target class; defaults to the shared statusbar item. */
  className?: string;
  /**
   * Render the trigger with the short label ("Debug") — for narrow
   * footers (the side panel) where the full title wraps. The popover
   * title always keeps the full name.
   */
  shortLabel?: boolean;
  /** Popover placement; footers open upward by default. */
  placement?: TooltipPlacement;
  /**
   * If provided, the popover title shows an (i) button that calls this with
   * `DEBUG_DOCS_SECTION_ID`. Surfaces with a docs panel wire it to their
   * `openDocs`; popup / sidepanel open `workbench.html#/docs/<id>`. Omit to
   * hide the button.
   */
  onOpenDocs?: (sectionId: string) => void;
}

export const DebugModePill: React.FC<DebugModePillProps> = ({
  tabSource,
  className,
  shortLabel,
  placement = 'top',
  onOpenDocs,
}) => {
  const t = useT();
  const triggerLabel = t(shortLabel ? 'shared.chrome.debug.titleShort' : 'shared.chrome.debug.title');
  const { token } = theme.useToken();
  const { snapshot } = useStatus();
  const [enabled, setEnabled] = useSetting('inspection.cdpEnabled');
  const settingsReady = useSettingsReady();
  const toggleLabel = useChordLabel('keyboard.toggleDebugMode');

  // The shortcut binds on every surface that mounts this pill — including
  // the DevTools panel, which has no shortcut registry of its own.
  useDebugModeShortcut();

  // Where the browser can't drive the debugging protocol, keep the control
  // visible-but-disabled so the feature stays discoverable (Firefox / Safari).
  // Non-browser hosts (desktop) have nothing to debug, so render nothing.
  if (!hasCapability('cdpInspection')) {
    if (getCurrentHost() !== 'extension') return null;
    return (
      <Tooltip title={t('shared.chrome.debug.unavailableHint')}>
        <span
          className={className ?? 'rules-statusbar-item'}
          aria-label={`${t('shared.chrome.debug.title')} — ${t('shared.chrome.debug.unavailableHint')}`}
          aria-disabled
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.45, cursor: 'not-allowed' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="rules-dot" style={{ background: token.colorTextTertiary }} />
            {triggerLabel}
          </span>
          <Switch size="small" disabled checked={false} aria-label={t('shared.chrome.debug.toggleAria')} />
        </span>
      </Tooltip>
    );
  }

  const entry = snapshot.cdp;
  const dotColor = !enabled
    ? token.colorTextTertiary
    : entry?.state === 'red'
      ? token.colorError
      : entry?.state === 'yellow'
        ? token.colorWarning
        : token.colorSuccess;

  const title = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <Typography.Text strong style={{ fontSize: 12 }}>
        {t('shared.chrome.debug.title')}
      </Typography.Text>
      {onOpenDocs && (
        <Tooltip title={t('shared.chrome.debug.aboutTooltip')}>
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined style={{ fontSize: 12 }} />}
            onClick={() => onOpenDocs(DEBUG_DOCS_SECTION_ID)}
            aria-label={t('shared.chrome.debug.openDocsAria')}
            style={{ padding: '0 4px', height: 20, minWidth: 'auto' }}
          />
        </Tooltip>
      )}
    </div>
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Popover
        placement={placement}
        trigger={['click', 'hover']}
        title={title}
        content={<DebugModeControls entry={entry} tabSource={tabSource} enabled={enabled} />}
      >
        <span
          className={className ?? 'rules-statusbar-item'}
          role="button"
          aria-label={t('shared.chrome.debug.controlsAria')}
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span className="rules-dot" style={{ background: dotColor }} />
          {triggerLabel}
        </span>
      </Popover>
      {/* Mount the switch only after settings hydrate, else it animates from the
          default on popup re-open; width reserved so the late mount can't shift. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28 }}>
        {settingsReady && (
          <Tooltip
            title={
              <ShortcutHintTitle label={toggleLabel}>
                {enabled ? t('shared.chrome.debug.turnOff') : t('shared.chrome.debug.turnOn')}
              </ShortcutHintTitle>
            }
          >
            <Switch size="small" checked={enabled} onChange={setEnabled} aria-label={t('shared.chrome.debug.toggleAria')} />
          </Tooltip>
        )}
      </span>
    </span>
  );
};

interface DebugModeControlsProps {
  entry: StatusEntry | undefined;
  tabSource: DebugModeTabSource;
  enabled: boolean;
}

const DebugModeControls: React.FC<DebugModeControlsProps> = ({ entry, tabSource, enabled }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [scope, setScope] = useSetting('inspection.cdpScope');
  const tabId = useControlTabId(tabSource);
  const roster = readCdpRoster(entry?.context);
  const pinnedHere = tabId != null && readCdpPinnedTabs(entry?.context).includes(tabId);
  const showPin = tabId != null && (pinnedHere || pinAddsValue(tabSource, scope));

  const togglePin = (checked: boolean): void => {
    if (tabId == null) return;
    void hostBridge.call('setCdpTabPin', { tabId, pinned: checked }).catch(() => {});
  };

  return (
    // Scale antd controls down to the popover's text size — their default
    // (14px) reads oversized next to the 11px labels.
    <ConfigProvider theme={{ token: { fontSize: 12 } }}>
      <div
        style={{ width: 'min(380px, calc(100vw - 48px))', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {entry && entry.state !== 'green' && (
          // Surface a fault (e.g. a banner-cancel fall-back, or an attach
          // failure) so the yellow/red dot has an explanation on hover.
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                marginTop: 5,
                flex: '0 0 auto',
                background: entry.state === 'red' ? token.colorError : token.colorWarning,
              }}
            />
            <Typography.Text
              style={{ fontSize: 11, color: entry.state === 'red' ? token.colorError : token.colorWarning }}
            >
              {entry.message}
            </Typography.Text>
          </div>
        )}
        <ControlRow label={t('shared.chrome.debug.attachTo')} token={token}>
          <Select
            size="small"
            value={scope}
            onChange={(value: CdpScopeMode) => setScope(value)}
            options={SCOPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            style={{ width: 190 }}
          />
        </ControlRow>

        {showPin && (
          <ControlRow label={t('shared.chrome.debug.includeThisTab')} token={token}>
            <Switch
              size="small"
              checked={pinnedHere}
              onChange={togglePin}
              aria-label={t('shared.chrome.debug.pinThisTabAria')}
            />
          </ControlRow>
        )}

        {/* The roster section only exists once inspection is on — when off
            there's nothing to attach, so the header + empty row are just noise. */}
        {enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Typography.Text style={{ fontSize: 10, color: token.colorTextTertiary }}>
                {t('shared.chrome.debug.attachedTabs')}
              </Typography.Text>
              {roster.length > 0 && (
                <Badge
                  count={roster.length}
                  color={token.colorTextTertiary}
                  size="small"
                  style={{ color: token.colorBgContainer }}
                />
              )}
            </div>
            {roster.length > 0 ? (
              roster.map((tab) => (
                <RosterRow key={tab.tabId} tab={tab} token={token} isCurrent={tabId != null && tab.tabId === tabId} />
              ))
            ) : (
              <Typography.Text style={{ fontSize: 11, color: token.colorTextTertiary, padding: '2px 4px' }}>
                {t('shared.chrome.debug.noTabsAttached')}
              </Typography.Text>
            )}
          </div>
        )}

        <div style={{ marginTop: 2, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Text style={{ fontSize: 10, color: token.colorTextTertiary }}>
            {t('shared.chrome.debug.bannerNote')}
          </Typography.Text>
        </div>
      </div>
    </ConfigProvider>
  );
};

interface ControlRowProps {
  label: string;
  token: ReturnType<typeof theme.useToken>['token'];
  children: React.ReactNode;
}

const ControlRow: React.FC<ControlRowProps> = ({ label, token, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <Typography.Text style={{ fontSize: 11, color: token.colorText }}>{label}</Typography.Text>
    {children}
  </div>
);

interface RosterRowProps {
  tab: CdpRosterTab;
  token: ReturnType<typeof theme.useToken>['token'];
  /** This roster row is the tab the surface is currently on. */
  isCurrent: boolean;
}

const RosterRow: React.FC<RosterRowProps> = ({ tab, token, isCurrent }) => {
  const t = useT();
  const handle = { kind: 'chrome-tab' as const, tabId: tab.tabId, windowId: tab.windowId, url: tab.url || undefined };
  // The tab you're already on isn't a "switch to" target — it's highlighted
  // instead, not clickable and with no jump affordance.
  const navigable = !isCurrent && isPeerNavigable(handle);
  const label = tab.title || tab.url || t('shared.chrome.debug.tabFallback', { id: tab.tabId });
  const tooltip = isCurrent
    ? t('shared.chrome.debug.onThisTab')
    : navigable
      ? t('shared.chrome.debug.switchTo', { target: tab.url || label })
      : tab.url || label;
  return (
    <Tooltip title={tooltip} placement="top">
      <button
        type="button"
        disabled={!navigable}
        onClick={navigable ? () => void peerNavigate(handle) : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '2px 4px',
          border: 'none',
          borderRadius: 4,
          background: isCurrent ? token.colorPrimaryBg : 'transparent',
          color: 'inherit',
          cursor: navigable ? 'pointer' : 'default',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        {tab.pinned && <PushpinFilled style={{ fontSize: 10, color: token.colorTextTertiary, flex: '0 0 auto' }} />}
        <span style={{ fontSize: 11, color: token.colorTextTertiary, flex: '0 0 auto' }}>
          {t('shared.chrome.debug.tabNumber', { number: tab.index + 1 })}
        </span>
        <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {navigable && <ExportOutlined style={{ fontSize: 10, color: token.colorTextTertiary, flex: '0 0 auto' }} />}
      </button>
    </Tooltip>
  );
};
