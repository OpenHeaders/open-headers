/**
 * DebugModePill — the standalone footer control for deep request inspection
 * (the browser's debugging protocol). Sits to the LEFT of the System Status
 * pill on every surface and opens its own popover on hover / click, mirroring
 * the System Status trigger.
 *
 * Named "Debug mode" because the browser shows a "<app> is debugging this
 * browser" banner on each attached tab — the control's label matches what the
 * user actually sees.
 *
 * The on/off switch lives in the popover title row; scope + pin are shown
 * regardless of on/off, so the user can pick the scope and pin tabs BEFORE
 * enabling. Everything derives from canonical state (settings + the live SW
 * attach snapshot); nothing is cached locally:
 *   - master toggle  → `inspection.cdpEnabled` setting (title row).
 *   - scope dropdown → `inspection.cdpScope` setting.
 *   - attached roster → the live `cdp` Status entry's `context.tabs`, each row
 *     jumping to its tab through the host-agnostic peer-navigator seam.
 *   - "include this browser tab" pin → reflects `context.pinnedTabs` (carried
 *     even while off) and writes through the `setCdpTabPin` RPC. Shown only
 *     when the current tab isn't already covered by the scope (else it would
 *     be redundant).
 *
 * Capability-gated: renders nothing on hosts without the `cdpInspection`
 * capability (Firefox / Safari / desktop). Chrome-free — tab id resolution,
 * titles, and jump-to-tab all go through host seams, never `chrome.*`.
 */

import { ExportOutlined, PushpinFilled } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { hasCapability } from '@openheaders/core/capabilities';
import { hostNavigation } from '@openheaders/core/navigation';
import type { CdpRosterTab, CdpScopeMode } from '@openheaders/core/types';
import { readCdpPinnedTabs, readCdpRoster } from '@openheaders/core/types';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { Badge, ConfigProvider, Popover, Select, Switch, Tooltip, Typography, theme } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import React, { useEffect, useState } from 'react';
import { isPeerNavigable, peerNavigate } from '../awareness/peer-navigate';
import { useStatus } from '../hooks/useStatus';
import type { StatusEntry } from '../status/types';

/**
 * Where the "this tab" pin resolves its target. The panel inspects a fixed
 * tab; the popup / side panel follow the active tab; the workbench is
 * tab-agnostic, so it shows no pin row.
 */
export type DebugModeTabSource = 'inspected' | 'active' | 'none';

const SCOPE_OPTIONS: { label: string; value: CdpScopeMode }[] = [
  { label: 'Where DevTools is open', value: 'devtools' },
  { label: 'The focused tab', value: 'active' },
  { label: 'Both', value: 'both' },
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
  /** Popover placement; footers open upward by default. */
  placement?: TooltipPlacement;
}

export const DebugModePill: React.FC<DebugModePillProps> = ({ tabSource, className, placement = 'top' }) => {
  const { token } = theme.useToken();
  const { snapshot } = useStatus();
  const [enabled, setEnabled] = useSetting('inspection.cdpEnabled');

  // Render nothing where the host can't drive the debugging protocol.
  if (!hasCapability('cdpInspection')) return null;

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
        Debug mode
      </Typography.Text>
      <Tooltip title={enabled ? 'Turn off deep request inspection' : 'Turn on deep request inspection'}>
        <Switch
          checked={enabled}
          onChange={setEnabled}
          checkedChildren={<span style={{ fontSize: 11 }}>Enabled</span>}
          unCheckedChildren={<span style={{ fontSize: 11 }}>Disabled</span>}
          aria-label="Toggle debug mode"
        />
      </Tooltip>
    </div>
  );

  return (
    <Popover
      placement={placement}
      trigger={['click', 'hover']}
      title={title}
      content={<DebugModeControls entry={entry} tabSource={tabSource} enabled={enabled} />}
    >
      <span
        className={className ?? 'rules-statusbar-item'}
        role="button"
        aria-label="Debug mode controls"
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <span className="rules-dot" style={{ background: dotColor }} />
        Debug mode
      </span>
    </Popover>
  );
};

/**
 * Resolve the tab the "include this browser tab" pin acts on for the current
 * surface. `inspected` reads the fixed panel tab synchronously; `active`
 * follows the focused tab and re-resolves whenever it changes; `none` yields
 * `null`.
 */
function useControlTabId(tabSource: DebugModeTabSource): number | null {
  const [tabId, setTabId] = useState<number | null>(() =>
    tabSource === 'inspected' ? hostNavigation.inspectedTabId() : null,
  );

  useEffect(() => {
    if (tabSource === 'inspected') {
      setTabId(hostNavigation.inspectedTabId());
      return;
    }
    if (tabSource !== 'active') {
      setTabId(null);
      return;
    }
    let cancelled = false;
    const resolve = (): void => {
      void hostNavigation.getActiveTab().then((tab) => {
        if (!cancelled) setTabId(tab?.id ?? null);
      });
    };
    resolve();
    const unsubscribe = hostNavigation.observeActiveTabContext(resolve);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tabSource]);

  return tabId;
}

interface DebugModeControlsProps {
  entry: StatusEntry | undefined;
  tabSource: DebugModeTabSource;
  enabled: boolean;
}

const DebugModeControls: React.FC<DebugModeControlsProps> = ({ entry, tabSource, enabled }) => {
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
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        <ControlRow label="Inspect" token={token}>
          <Select
            size="small"
            value={scope}
            onChange={(value: CdpScopeMode) => setScope(value)}
            options={SCOPE_OPTIONS}
            style={{ width: 190 }}
          />
        </ControlRow>

        {showPin && (
          <ControlRow label="Include this browser tab" token={token}>
            <Switch size="small" checked={pinnedHere} onChange={togglePin} aria-label="Pin this browser tab" />
          </ControlRow>
        )}

        {/* The roster section only exists once inspection is on — when off
            there's nothing to attach, so the header + empty row are just noise. */}
        {enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Typography.Text style={{ fontSize: 10, color: token.colorTextTertiary }}>
                Attached tabs
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
                No tabs attached yet
              </Typography.Text>
            )}
          </div>
        )}

        <div style={{ marginTop: 2, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Text style={{ fontSize: 10, color: token.colorTextTertiary }}>
            While debug mode is on, the browser's banner “OH started debugging this browser” shows on every tab — not just the
            ones it's attached to.
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
  const handle = { kind: 'chrome-tab' as const, tabId: tab.tabId, windowId: tab.windowId, url: tab.url || undefined };
  // The tab you're already on isn't a "switch to" target — it's highlighted
  // instead, not clickable and with no jump affordance.
  const navigable = !isCurrent && isPeerNavigable(handle);
  const label = tab.title || tab.url || `Tab ${tab.tabId}`;
  const tooltip = isCurrent ? "You're on this tab" : navigable ? `Switch to ${tab.url || label}` : tab.url || label;
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
        <span style={{ fontSize: 11, color: token.colorTextTertiary, flex: '0 0 auto' }}>Tab #{tab.index + 1}</span>
        <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {navigable && <ExportOutlined style={{ fontSize: 10, color: token.colorTextTertiary, flex: '0 0 auto' }} />}
      </button>
    </Tooltip>
  );
};
