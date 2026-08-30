/**
 * WebSocketSettingsTab — per-request connection knobs in the request
 * Settings tab's exact anatomy (the MQTT Settings tab's discipline):
 * collapsible group sections (Connection · Session resilience ·
 * Socket.IO · TLS & trust)
 * whose headers carry the (i) group popovers, `label · (i) · control`
 * rows from the shared settings-row family with the effective
 * defaults legible in the controls, modified dots, and per-row
 * resets. The Socket.IO group renders on that flavor only; the
 * Connection group seats the shared `DialRows` block between the
 * subprotocol offer (raw flavor — engine.io negotiates none) and the
 * socket path and closes on the limits —
 * the max message size (every runtime: the executor's own cap) and
 * the handshake redirect pair (node runtimes; the browser client
 * never follows); the Session resilience group
 * is the shared `SessionResilienceGroup` block (the raw flavor's idle
 * + heartbeat rows, the socketio flavor's idle row); the TLS & trust
 * group is the shared `TlsTrustGroup` block. The runtime-managed
 * sheet under the groups states what the host fixes: the
 * permessage-deflate offer, the socketio flavor's WebSocket-only
 * transport, and on the browser the never-followed redirect. Every
 * (i) — own rows, shared rows, group headers, sheet facts — leads with
 * the session example card of the flavor, its slice lit.
 *
 * The tab edits the draft directly, so the dots track distance from
 * the PROTOCOL defaults — there is no saved-baseline (unsaved) plane
 * here; the editor's own dirty fingerprint covers "not saved yet".
 * The connect timeout states "No limit" honestly: no transport arms a
 * dial deadline unless the request carries one.
 */

import { getCapability, type RequestRuntimeKind } from '@openheaders/core/capabilities';
import {
  isValidUnixSocketPath,
  MAX_MAX_REDIRECTS,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  MAX_UNIX_SOCKET_PATH_LENGTH,
  MIN_MAX_REDIRECTS,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_RESPONSE_BYTES,
} from '@openheaders/core/schemas';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  byteSizeInterpreter,
  countInterpreter,
  durationMsInterpreter,
  formatByteSize,
  formatDurationMs,
  numericPresets,
} from '@openheaders/ui/shared/combo-knob';
import {
  ComboKnobRow,
  GroupSection,
  KnobRow,
  type RuntimeManagedRowDef,
  RuntimeManagedSheet,
  SelectKnobRow,
  TagsKnobRow,
  TextKnobRow,
} from '@openheaders/ui/shared/settings-rows';
import { ConfigProvider, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import DialRows, { isDialModified } from '../shared/dial/DialRows';
import SessionResilienceGroup from '../shared/resilience/SessionResilienceGroup';
import TlsTrustGroup from '../shared/tls-trust/TlsTrustGroup';
import type { WebSocketDraft } from './draft';
import { WS_GROUP_LABEL_KEY, WS_GROUP_ORDER, type WsSettingsGroupKey } from './settings-groups';
import {
  type WsExampleToken,
  type WsInfoKey,
  wsExampleCard,
  wsSettingsGroupInfo,
  wsSettingsRowInfo,
} from './WebSocketSettingsRowInfo';

/** The Socket.IO handshake path and namespace are URL paths; cap
 *  them generously. */
const MAX_SOCKETIO_PATH_LENGTH = 256;

/** The connect timeout is app milliseconds on the wire — free text
 *  becomes concrete candidates ("30" → "30 ms" / "30 s"); readings
 *  outside the field's range stay visible as disabled entries naming
 *  the violated bound. */
const interpretTimeout = durationMsInterpreter({ min: MIN_REQUEST_TIMEOUT_MS, max: MAX_REQUEST_TIMEOUT_MS });
const TIMEOUT_PRESETS = numericPresets([1_000, 5_000, 10_000, 30_000, 60_000], formatDurationMs);
/** The message cap shares the HTTP response cap's bounds. */
const interpretMessageSize = byteSizeInterpreter({ min: MIN_RESPONSE_BYTES, max: MAX_RESPONSE_BYTES });
const SIZE_PRESETS = numericPresets(
  [256, 512, 1024, 2048, 5120, 10240].map((kb) => kb * 1024),
  formatByteSize,
);
const REDIRECT_BOUNDS = { min: MIN_MAX_REDIRECTS, max: MAX_MAX_REDIRECTS };
const REDIRECT_PRESET_VALUES = [5, 10, 20, 50];

/** The facts the host fixes for every session — the runtime-managed
 *  sheet's rows, in the tab's group vocabulary, each naming its slice
 *  of the session example card. */
type ManagedRowDef = RuntimeManagedRowDef<WsSettingsGroupKey> & { tokens: readonly WsExampleToken[] };
const MANAGED_COMPRESSION: ManagedRowDef = {
  labelKey: 'workbench.editors.request.settings.managed.compression',
  valueKey: 'workbench.editors.request.settings.managed.offered',
  descriptionKey: 'workbench.editors.request.settings.managed.compressionWsDesc',
  group: 'connection',
  tokens: ['deflate'],
  testId: 'websocket-managed-compression',
};
const MANAGED_TRANSPORT: ManagedRowDef = {
  labelKey: 'workbench.editors.request.settings.managed.transport',
  valueKey: 'workbench.editors.request.settings.managed.websocketOnly',
  descriptionKey: 'workbench.editors.request.settings.managed.transportSocketioDesc',
  group: 'socketio',
  tokens: ['transport'],
  testId: 'websocket-managed-transport',
};
const BROWSER_MANAGED_REDIRECTS: ManagedRowDef = {
  labelKey: 'workbench.editors.request.settings.followRedirects',
  valueKey: 'workbench.editors.request.settings.managed.never',
  descriptionKey: 'workbench.editors.request.settings.managed.followRedirectsBrowserDesc',
  group: 'connection',
  tokens: ['chain'],
  testId: 'websocket-managed-follow-redirects',
};

/** Session-scoped memory of the group folds: the tab unmounts on
 *  every editor tab switch, and a fold choice must survive that.
 *  Shared by every WebSocket editor — a fold is a reading preference,
 *  not per-request state — and deliberately not persisted to disk. */
const sessionCollapsed: Record<string, boolean> = {};

interface WebSocketSettingsTabProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  socketioFlavor: boolean;
}

const WebSocketSettingsTab: React.FC<WebSocketSettingsTabProps> = ({ draft, setDraft, socketioFlavor }) => {
  const t = useT();
  const { token } = theme.useToken();
  const runtime: RequestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  // Redirect-cap candidates carry a localized "hops" unit, so the
  // interpreter is minted here where `t` lives (the HTTP tab's mint).
  const formatHops = (count: number): string => t('workbench.editors.request.settings.maxRedirectsHops', { count });
  const redirectPresets = REDIRECT_PRESET_VALUES.map((v) => ({ value: v, label: formatHops(v) }));
  const interpretHops = countInterpreter(REDIRECT_BOUNDS, formatHops);
  const flavor = socketioFlavor ? 'socketio' : 'raw';
  const rowInfo = (key: WsInfoKey) => wsSettingsRowInfo(t, key, flavor);
  const groupInfo = (group: WsSettingsGroupKey) => wsSettingsGroupInfo(t, group, flavor);
  const managedRows = [
    MANAGED_COMPRESSION,
    ...(socketioFlavor ? [MANAGED_TRANSPORT] : []),
    ...(runtime === 'browser' ? [BROWSER_MANAGED_REDIRECTS] : []),
  ].map(({ tokens, ...def }) => ({ ...def, diagram: wsExampleCard(tokens, flavor) }));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  const connectionModified =
    (!socketioFlavor && draft.subprotocols.length > 0) ||
    isDialModified(draft) ||
    draft.unixSocketPath !== undefined ||
    draft.timeoutMs !== undefined ||
    draft.maxMessageBytes !== undefined ||
    draft.followRedirects ||
    draft.maxRedirects !== undefined;
  const socketioModified =
    draft.namespace !== '' ||
    draft.handshakePath !== '' ||
    draft.socketioProtocol !== undefined ||
    draft.ackTimeoutMs !== undefined;
  const protocolOptions = [
    { value: 'v5', label: t('workbench.editors.websocket.settings.socketioProtocolV5') },
    { value: 'v4', label: t('workbench.editors.websocket.settings.socketioProtocolV4') },
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          // An empty knob means "the default in effect" — its stated
          // default must read as live behavior, not a disabled
          // control, so placeholders render at full text contrast,
          // exactly like a set value; the dot and reset affordances
          // carry the customized-vs-default distinction.
          Select: { colorTextPlaceholder: token.colorText },
          Input: { colorTextPlaceholder: token.colorText },
        },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
        <GroupSection
          label={t(WS_GROUP_LABEL_KEY.connection)}
          expanded={collapsed.connection !== true}
          onToggle={() => toggleGroup('connection')}
          info={groupInfo('connection')}
          modified={connectionModified}
        >
          {!socketioFlavor && (
            <TagsKnobRow
              label={t('workbench.editors.websocket.settings.subprotocolsLabel')}
              value={draft.subprotocols}
              onChange={(subprotocols) => setDraft((d) => ({ ...d, subprotocols }))}
              info={rowInfo('subprotocols')}
              placeholder={t('workbench.editors.websocket.settings.subprotocolsPlaceholder')}
              example={t('workbench.editors.websocket.settings.subprotocolsExample')}
              testId="websocket-subprotocols"
            />
          )}
          <DialRows
            groupLabel={t(WS_GROUP_LABEL_KEY.connection)}
            value={draft}
            onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
            rowInfo={rowInfo}
            testIdPrefix="websocket"
          />
          <TextKnobRow
            label={t('workbench.editors.websocket.settings.unixSocketLabel')}
            value={draft.unixSocketPath}
            onChange={(unixSocketPath) => setDraft((d) => ({ ...d, unixSocketPath }))}
            info={rowInfo('unixSocket')}
            placeholder={t('workbench.editors.websocket.settings.unixSocketPlaceholder')}
            maxLength={MAX_UNIX_SOCKET_PATH_LENGTH}
            error={
              draft.unixSocketPath !== undefined && !isValidUnixSocketPath(draft.unixSocketPath)
                ? t('workbench.editors.request.settings.unixSocketError')
                : undefined
            }
            example={t('workbench.editors.request.settings.unixSocketExample')}
            testId="websocket-unix-socket"
          />
          <ComboKnobRow
            label={t('workbench.editors.websocket.settings.timeoutLabel')}
            value={draft.timeoutMs}
            onChange={(timeoutMs) => setDraft((d) => ({ ...d, timeoutMs }))}
            info={rowInfo('timeout')}
            presets={TIMEOUT_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            placeholder={t('workbench.editors.websocket.settings.timeoutPlaceholder')}
            testId="websocket-timeout"
          />
          <ComboKnobRow
            label={t('workbench.editors.request.settings.maxMessageSize')}
            value={draft.maxMessageBytes}
            onChange={(maxMessageBytes) => setDraft((d) => ({ ...d, maxMessageBytes }))}
            info={rowInfo('maxMessageSize')}
            presets={SIZE_PRESETS}
            interpret={interpretMessageSize}
            format={formatByteSize}
            placeholder={t('workbench.editors.request.settings.maxMessageSizePlaceholder')}
            testId="websocket-max-message-size"
          />
          {runtime === 'node' && (
            <>
              <KnobRow
                label={t('workbench.editors.request.settings.followRedirects')}
                checked={draft.followRedirects}
                modified={draft.followRedirects}
                onReset={() => setDraft((d) => ({ ...d, followRedirects: false }))}
                onChange={(followRedirects) => setDraft((d) => ({ ...d, followRedirects }))}
                info={rowInfo('followRedirects')}
                testId="websocket-follow-redirects"
              />
              {draft.followRedirects && (
                <ComboKnobRow
                  label={t('workbench.editors.request.settings.maxRedirects')}
                  value={draft.maxRedirects}
                  onChange={(maxRedirects) => setDraft((d) => ({ ...d, maxRedirects }))}
                  info={rowInfo('maxRedirects')}
                  presets={redirectPresets}
                  interpret={interpretHops}
                  format={formatHops}
                  placeholder={t('workbench.editors.request.settings.maxRedirectsPlaceholder')}
                  testId="websocket-max-redirects"
                />
              )}
            </>
          )}
        </GroupSection>
        <SessionResilienceGroup
          groupLabel={t(WS_GROUP_LABEL_KEY.resilience)}
          groupInfo={groupInfo('resilience')}
          expanded={collapsed.resilience !== true}
          onToggle={() => toggleGroup('resilience')}
          value={draft}
          onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
          liveness={flavor}
          rowInfo={rowInfo}
          testIdPrefix="websocket"
        />
        {socketioFlavor && (
          <GroupSection
            label={t(WS_GROUP_LABEL_KEY.socketio)}
            expanded={collapsed.socketio !== true}
            onToggle={() => toggleGroup('socketio')}
            info={groupInfo('socketio')}
            modified={socketioModified}
          >
            <TextKnobRow
              label={t('workbench.editors.websocket.settings.handshakePathLabel')}
              value={draft.handshakePath === '' ? undefined : draft.handshakePath}
              onChange={(handshakePath) => setDraft((d) => ({ ...d, handshakePath: handshakePath ?? '' }))}
              info={rowInfo('handshakePath')}
              placeholder={t('workbench.editors.websocket.settings.handshakePathPlaceholder')}
              maxLength={MAX_SOCKETIO_PATH_LENGTH}
              example={t('workbench.editors.websocket.settings.handshakePathExample')}
              testId="websocket-handshake-path"
            />
            <TextKnobRow
              label={t('workbench.editors.websocket.settings.namespaceLabel')}
              value={draft.namespace === '' ? undefined : draft.namespace}
              onChange={(namespace) => setDraft((d) => ({ ...d, namespace: namespace ?? '' }))}
              info={rowInfo('namespace')}
              placeholder={t('workbench.editors.websocket.settings.namespacePlaceholder')}
              maxLength={MAX_SOCKETIO_PATH_LENGTH}
              example={t('workbench.editors.websocket.settings.namespaceExample')}
              testId="websocket-namespace"
            />
            <SelectKnobRow
              label={t('workbench.editors.websocket.settings.socketioProtocolLabel')}
              value={draft.socketioProtocol === undefined ? undefined : `v${draft.socketioProtocol}`}
              onChange={(value) =>
                setDraft((d) => ({ ...d, socketioProtocol: value === 'v4' ? 4 : value === 'v5' ? 5 : undefined }))
              }
              info={rowInfo('socketioProtocol')}
              options={protocolOptions}
              placeholder={t('workbench.editors.websocket.settings.socketioProtocolPlaceholder')}
              modified={draft.socketioProtocol !== undefined}
              testId="websocket-socketio-protocol"
            />
            <ComboKnobRow
              label={t('workbench.editors.websocket.settings.ackTimeoutLabel')}
              value={draft.ackTimeoutMs}
              onChange={(ackTimeoutMs) => setDraft((d) => ({ ...d, ackTimeoutMs }))}
              info={rowInfo('ackTimeout')}
              presets={TIMEOUT_PRESETS}
              interpret={interpretTimeout}
              format={formatDurationMs}
              placeholder={t('workbench.editors.websocket.settings.ackTimeoutPlaceholder')}
              testId="websocket-ack-timeout"
            />
          </GroupSection>
        )}
        <TlsTrustGroup
          groupLabel={t(WS_GROUP_LABEL_KEY.tls)}
          groupInfo={groupInfo('tls')}
          expanded={collapsed.tls !== true}
          onToggle={() => toggleGroup('tls')}
          value={draft}
          onChange={(next) => setDraft((d) => ({ ...d, ...next, sslVerification: next.sslVerification !== false }))}
          rowInfo={rowInfo}
          testIdPrefix="websocket"
        />
        <RuntimeManagedSheet
          runtime={runtime}
          rows={managedRows}
          groupOrder={WS_GROUP_ORDER}
          groupLabel={(group) => t(WS_GROUP_LABEL_KEY[group])}
          groupInfo={groupInfo}
          expanded={(group) => collapsed[`sheet-${group}`] !== true}
          onToggle={(group) => toggleGroup(`sheet-${group}`)}
        />
      </div>
    </ConfigProvider>
  );
};

export default WebSocketSettingsTab;
