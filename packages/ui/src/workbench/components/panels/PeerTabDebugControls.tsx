/**
 * PeerTabDebugControls — the owning browser's Debug mode for ONE watched
 * tab, shown under the notice of a request whose content was never
 * captured.
 *
 * Three facts decide whether a tab's content is captured — the browser's
 * switch, the scope it attaches on its own, and whether this tab is
 * included — and each shows as what it is, in the words of the
 * extension's own Debug mode popover:
 *
 *   - the switch is the BROWSER'S Debug mode, the same one the source
 *     rail shows. Turning it on from here also includes this tab: the
 *     gesture that asks for this tab's content gets it;
 *   - once it is on, "Attach to" (where the browser reports its scope)
 *     and "Include this browser tab" say why this tab is or is not
 *     attached, and change it;
 *   - once this tab is covered, one line says what that changes — the
 *     request on screen has already run.
 *
 * Everything rides the relay command the source rail uses and reads the
 * shared answer (`peer-debug-state`), so a change made in the rail or in
 * the browser shows here too. A browser that cannot drive its debugger
 * shows the switch disabled; one that is no longer connected shows
 * nothing — there is nothing left to switch.
 */

import type { TelemetryDebugState } from '@openheaders/core/protocol';
import type { CdpScopeMode } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { ConfigProvider, Select, Switch, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DebugModeSwitch } from '@openheaders/ui/shared/debug-mode';
import {
  disableDebugMode,
  enableDebugModeForTab,
  isTabCovered,
  loadPeerDebugStates,
  peerDebugStatesRead,
  readPeerDebugState,
  setDebugScope,
  setTabIncluded,
  subscribePeerDebugStates,
} from '../../data/peer-debug-state';

export interface PeerTabDebugControlsProps {
  nodeId: string;
  tabId: number;
}

/**
 * The scope's choices as a watcher outside the browser reads them: "the
 * focused tab" there is whichever tab has the BROWSER'S focus, not the
 * one being looked at here.
 */
const SCOPE_OPTIONS: readonly { labelKey: MessageKey; value: CdpScopeMode }[] = [
  { labelKey: 'shared.chrome.debug.scopeDevtools', value: 'devtools' },
  { labelKey: 'shared.chrome.debug.scopeActiveRemote', value: 'active' },
  { labelKey: 'shared.chrome.debug.scopeBoth', value: 'both' },
];

const ControlRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <span>{label}</span>
    {children}
  </div>
);

const PeerTabDebugControls: React.FC<PeerTabDebugControlsProps> = ({ nodeId, tabId }) => {
  const t = useT();
  const { token } = theme.useToken();
  const debug = useSyncExternalStore(subscribePeerDebugStates, () => readPeerDebugState(nodeId));
  const read = useSyncExternalStore(subscribePeerDebugStates, peerDebugStatesRead);
  const [sending, setSending] = useState(false);

  // Mounted without the Traffic tool having published this browser: ask once.
  useEffect(() => {
    if (debug === undefined) void loadPeerDebugStates();
  }, [debug]);

  const send = useCallback((command: Promise<void>) => {
    setSending(true);
    void command.finally(() => setSending(false));
  }, []);
  const onToggle = useCallback(
    (on: boolean) => send(on ? enableDebugModeForTab(nodeId, tabId) : disableDebugMode(nodeId)),
    [send, nodeId, tabId],
  );

  if (debug === undefined) {
    // Still asking — hold the switch's place; asked and unknown — the browser is gone.
    return read ? null : <DebugModeSwitch available on={false} pending onChange={onToggle} />;
  }
  if (!debug.available) return <DebugModeSwitch available={false} on={false} onChange={onToggle} />;

  return (
    <div
      data-testid="peer-tab-debug-controls"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      <DebugModeSwitch available on={debug.enabled} pending={sending} onChange={onToggle} />
      {debug.enabled && (
        <EnabledControls debug={debug} nodeId={nodeId} tabId={tabId} sending={sending} send={send} />
      )}
      {isTabCovered(debug, tabId) && (
        <span data-testid="peer-tab-debug-covered" style={{ color: token.colorTextTertiary }}>
          {t('shared.chrome.debug.coversTabHint')}
        </span>
      )}
    </div>
  );
};

interface EnabledControlsProps extends PeerTabDebugControlsProps {
  debug: TelemetryDebugState;
  sending: boolean;
  send: (command: Promise<void>) => void;
}

/** The scope and this tab's inclusion — shown only while Debug mode is on. */
const EnabledControls: React.FC<EnabledControlsProps> = ({ debug, nodeId, tabId, sending, send }) => {
  const t = useT();
  const { token } = theme.useToken();
  return (
    // Scale antd controls down to the notice's text size.
    <ConfigProvider theme={{ token: { fontSize: 12 } }}>
      {/* One dashed box: these rows are what Debug mode attaches, and they add up. */}
      <div
        data-testid="peer-tab-debug-scope-box"
        style={{
          width: 'min(360px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 12px',
          border: `1px dashed ${token.colorBorder}`,
          borderRadius: token.borderRadius,
          textAlign: 'left',
        }}
      >
        {debug.scope !== undefined && (
          <>
            <ControlRow label={t('shared.chrome.debug.attachTo')}>
              <Select
                size="small"
                data-testid="peer-tab-debug-scope"
                value={debug.scope}
                disabled={sending}
                onChange={(scope: CdpScopeMode) => send(setDebugScope(nodeId, scope))}
                options={SCOPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                style={{ width: 210 }}
              />
            </ControlRow>
            <span data-testid="peer-tab-debug-and" style={{ color: token.colorTextQuaternary }}>
              {t('shared.chrome.debug.scopeAnd')}
            </span>
          </>
        )}
        <ControlRow label={t('shared.chrome.debug.includeThisTab')}>
          <Switch
            size="small"
            data-testid="peer-tab-debug-include"
            checked={debug.pinnedTabs.includes(tabId)}
            disabled={sending}
            onChange={(included) => send(setTabIncluded(nodeId, tabId, included))}
            aria-label={t('shared.chrome.debug.pinThisTabAria')}
          />
        </ControlRow>
      </div>
    </ConfigProvider>
  );
};

export default PeerTabDebugControls;
