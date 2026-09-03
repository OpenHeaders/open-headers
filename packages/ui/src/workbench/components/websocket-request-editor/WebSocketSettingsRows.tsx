/**
 * WebSocketSettingsRows — the WebSocket / Socket.IO Settings rows over
 * a props-driven VALUE (the kind's inheritable knobs plus the two
 * request-only ones), rendered by two hosts: the request's Settings
 * tab (`WebSocketSettingsTab`, which maps its draft to the value and
 * back, the switches concrete on the draft) and a collection's /
 * folder's Settings section (the `websocket` sub-tab over the
 * container's one `settings` object). Same groups, same rows, same
 * (i) copy in both — the lift, never a copy.
 *
 * Groups: Connection · Session resilience · Socket.IO · TLS & trust.
 * The Socket.IO group renders on that flavor — and always at a
 * container, whose requests may be either; a container likewise shows
 * every liveness row (a raw session's idle + heartbeat) and never the
 * request-only rows (the subprotocol offer, the namespace) nor the
 * runtime-managed sheet. On the ancestor plane (`inherited`) the rows
 * read their placeholders off the chain and dot any own value.
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
import type { KindSettings } from '@openheaders/core/settings-inheritance';
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
import DialRows, { isDialModified } from '../shared/dial/DialRows';
import { type InheritedSettingsView, inheritedRowsFor } from '../shared/inherited-settings/inherited-settings';
import SessionResilienceGroup from '../shared/resilience/SessionResilienceGroup';
import TlsTrustGroup from '../shared/tls-trust/TlsTrustGroup';
import { WS_GROUP_LABEL_KEY, WS_GROUP_ORDER, type WsSettingsGroupKey } from './settings-groups';
import {
  type WsExampleToken,
  type WsInfoKey,
  wsExampleCard,
  wsSettingsGroupInfo,
  wsSettingsRowInfo,
} from './WebSocketSettingsRowInfo';

export type WsFlavor = 'raw' | 'socketio';

/** The rows' value: the kind's inheritable knobs (every key optional,
 *  `undefined` = inherit or the runtime default) plus the request-only
 *  pair a container never carries. */
export interface WebSocketSettingsValue extends KindSettings<'websocket'> {
  subprotocols?: string[] | undefined;
  namespace?: string | undefined;
}

const WS_KNOB_KEYS = [
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'timeoutMs',
  'maxMessageBytes',
  'followRedirects',
  'maxRedirects',
] as const;

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

/** Session-scoped memory of the group folds: the rows unmount on
 *  every editor tab switch, and a fold choice must survive that.
 *  Shared by every WebSocket surface — a fold is a reading
 *  preference, not per-request state — and deliberately not persisted
 *  to disk. */
const sessionCollapsed: Record<string, boolean> = {};

export interface WebSocketSettingsRowsProps {
  value: WebSocketSettingsValue;
  /** The whole next value — the host merges it into its own draft. */
  onChange: (next: WebSocketSettingsValue) => void;
  flavor: WsFlavor;
  /** `request` (default): the request's own rows. `container`: every
   *  flavor's inheritable rows, the request-only rows and the sheet
   *  left out. */
  scope?: 'request' | 'container';
  /** Keys whose value differs from the saved baseline; absent = no
   *  such plane. */
  unsaved?: ReadonlySet<string>;
  /** The ancestor plane — see the shared blocks. */
  inherited?: InheritedSettingsView;
}

const WebSocketSettingsRows: React.FC<WebSocketSettingsRowsProps> = ({
  value,
  onChange,
  flavor,
  scope = 'request',
  unsaved,
  inherited,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const runtime: RequestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const container = scope === 'container';
  const socketio = flavor === 'socketio';
  const rows = inheritedRowsFor(inherited);
  const explicit = inherited !== undefined;
  const isUnsaved = (key: string): boolean => unsaved?.has(key) === true;
  const set = (patch: Partial<WebSocketSettingsValue>): void => onChange({ ...value, ...patch });
  // Redirect-cap candidates carry a localized "hops" unit, so the
  // interpreter is minted here where `t` lives (the HTTP tab's mint).
  const formatHops = (count: number): string => t('workbench.editors.request.settings.maxRedirectsHops', { count });
  const redirectPresets = REDIRECT_PRESET_VALUES.map((v) => ({ value: v, label: formatHops(v) }));
  const interpretHops = countInterpreter(REDIRECT_BOUNDS, formatHops);
  const rowInfo = (key: WsInfoKey) => wsSettingsRowInfo(t, key, flavor);
  const groupInfo = (group: WsSettingsGroupKey) => wsSettingsGroupInfo(t, group, flavor);
  const socketioRowInfo = (key: WsInfoKey) => wsSettingsRowInfo(t, key, 'socketio');
  const managedRows = [
    MANAGED_COMPRESSION,
    ...(socketio ? [MANAGED_TRANSPORT] : []),
    ...(runtime === 'browser' ? [BROWSER_MANAGED_REDIRECTS] : []),
  ].map(({ tokens, ...def }) => ({ ...def, diagram: wsExampleCard(tokens, flavor) }));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  const subprotocols = value.subprotocols ?? [];
  const follow = rows.toggle('followRedirects', value.followRedirects, false);
  const connectionModified =
    (!socketio && !container && subprotocols.length > 0) ||
    (explicit
      ? WS_KNOB_KEYS.some((key) => value[key] !== undefined)
      : isDialModified(value) ||
        value.unixSocketPath !== undefined ||
        value.timeoutMs !== undefined ||
        value.maxMessageBytes !== undefined ||
        value.followRedirects === true ||
        value.maxRedirects !== undefined);
  const socketioModified =
    (!container && value.namespace !== undefined) ||
    value.handshakePath !== undefined ||
    value.socketioProtocol !== undefined ||
    value.ackTimeoutMs !== undefined;
  const protocolOptions = [
    { value: 'v5', label: t('workbench.editors.websocket.settings.socketioProtocolV5') },
    { value: 'v4', label: t('workbench.editors.websocket.settings.socketioProtocolV4') },
  ];
  const protocolLabel = (protocol: 4 | 5): string =>
    t(
      protocol === 4
        ? 'workbench.editors.websocket.settings.socketioProtocolV4'
        : 'workbench.editors.websocket.settings.socketioProtocolV5',
    );

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
          unsaved={WS_KNOB_KEYS.some(isUnsaved)}
        >
          {!socketio && !container && (
            <TagsKnobRow
              label={t('workbench.editors.websocket.settings.subprotocolsLabel')}
              value={subprotocols}
              onChange={(next) => set({ subprotocols: next })}
              info={rowInfo('subprotocols')}
              placeholder={t('workbench.editors.websocket.settings.subprotocolsPlaceholder')}
              example={t('workbench.editors.websocket.settings.subprotocolsExample')}
              testId="websocket-subprotocols"
            />
          )}
          <DialRows
            groupLabel={t(WS_GROUP_LABEL_KEY.connection)}
            value={value}
            onChange={(next) => set(next)}
            rowInfo={rowInfo}
            unsaved={unsaved}
            inherited={inherited}
            testIdPrefix="websocket"
          />
          <TextKnobRow
            label={t('workbench.editors.websocket.settings.unixSocketLabel')}
            value={value.unixSocketPath}
            onChange={(unixSocketPath) => set({ unixSocketPath })}
            info={rowInfo('unixSocket')}
            {...rows.field(
              'unixSocketPath',
              value.unixSocketPath,
              t('workbench.editors.websocket.settings.unixSocketPlaceholder'),
              String,
            )}
            maxLength={MAX_UNIX_SOCKET_PATH_LENGTH}
            error={
              value.unixSocketPath !== undefined && !isValidUnixSocketPath(value.unixSocketPath)
                ? t('workbench.editors.request.settings.unixSocketError')
                : undefined
            }
            example={t('workbench.editors.request.settings.unixSocketExample')}
            unsaved={isUnsaved('unixSocketPath')}
            testId="websocket-unix-socket"
          />
          <ComboKnobRow
            label={t('workbench.editors.websocket.settings.timeoutLabel')}
            value={value.timeoutMs}
            onChange={(timeoutMs) => set({ timeoutMs })}
            info={rowInfo('timeout')}
            presets={TIMEOUT_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            {...rows.field(
              'timeoutMs',
              value.timeoutMs,
              t('workbench.editors.websocket.settings.timeoutPlaceholder'),
              formatDurationMs,
            )}
            unsaved={isUnsaved('timeoutMs')}
            testId="websocket-timeout"
          />
          <ComboKnobRow
            label={t('workbench.editors.request.settings.maxMessageSize')}
            value={value.maxMessageBytes}
            onChange={(maxMessageBytes) => set({ maxMessageBytes })}
            info={rowInfo('maxMessageSize')}
            presets={SIZE_PRESETS}
            interpret={interpretMessageSize}
            format={formatByteSize}
            {...rows.field(
              'maxMessageBytes',
              value.maxMessageBytes,
              t('workbench.editors.request.settings.maxMessageSizePlaceholder'),
              formatByteSize,
            )}
            unsaved={isUnsaved('maxMessageBytes')}
            testId="websocket-max-message-size"
          />
          {runtime === 'node' && (
            <>
              <KnobRow
                label={t('workbench.editors.request.settings.followRedirects')}
                checked={follow.checked}
                modified={explicit ? value.followRedirects !== undefined : value.followRedirects === true}
                unsaved={isUnsaved('followRedirects')}
                onReset={() => set({ followRedirects: undefined })}
                onChange={(followRedirects) => set({ followRedirects })}
                info={rowInfo('followRedirects')}
                note={follow.note}
                testId="websocket-follow-redirects"
              />
              {follow.checked && (
                <ComboKnobRow
                  label={t('workbench.editors.request.settings.maxRedirects')}
                  value={value.maxRedirects}
                  onChange={(maxRedirects) => set({ maxRedirects })}
                  info={rowInfo('maxRedirects')}
                  presets={redirectPresets}
                  interpret={interpretHops}
                  format={formatHops}
                  {...rows.field(
                    'maxRedirects',
                    value.maxRedirects,
                    t('workbench.editors.request.settings.maxRedirectsPlaceholder'),
                    formatHops,
                  )}
                  unsaved={isUnsaved('maxRedirects')}
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
          value={value}
          onChange={(next) => set(next)}
          liveness={container ? 'raw' : flavor}
          rowInfo={rowInfo}
          unsaved={unsaved}
          inherited={inherited}
          testIdPrefix="websocket"
        />
        {(socketio || container) && (
          <GroupSection
            label={t(WS_GROUP_LABEL_KEY.socketio)}
            expanded={collapsed.socketio !== true}
            onToggle={() => toggleGroup('socketio')}
            info={wsSettingsGroupInfo(t, 'socketio', 'socketio')}
            modified={socketioModified}
            unsaved={isUnsaved('handshakePath') || isUnsaved('socketioProtocol') || isUnsaved('ackTimeoutMs')}
          >
            <TextKnobRow
              label={t('workbench.editors.websocket.settings.handshakePathLabel')}
              value={value.handshakePath}
              onChange={(handshakePath) => set({ handshakePath })}
              info={socketioRowInfo('handshakePath')}
              {...rows.field(
                'handshakePath',
                value.handshakePath,
                t('workbench.editors.websocket.settings.handshakePathPlaceholder'),
                String,
              )}
              maxLength={MAX_SOCKETIO_PATH_LENGTH}
              example={t('workbench.editors.websocket.settings.handshakePathExample')}
              unsaved={isUnsaved('handshakePath')}
              testId="websocket-handshake-path"
            />
            {!container && (
              <TextKnobRow
                label={t('workbench.editors.websocket.settings.namespaceLabel')}
                value={value.namespace}
                onChange={(namespace) => set({ namespace })}
                info={socketioRowInfo('namespace')}
                placeholder={t('workbench.editors.websocket.settings.namespacePlaceholder')}
                maxLength={MAX_SOCKETIO_PATH_LENGTH}
                example={t('workbench.editors.websocket.settings.namespaceExample')}
                testId="websocket-namespace"
              />
            )}
            <SelectKnobRow
              label={t('workbench.editors.websocket.settings.socketioProtocolLabel')}
              value={value.socketioProtocol === undefined ? undefined : `v${value.socketioProtocol}`}
              onChange={(next) => set({ socketioProtocol: next === 'v4' ? 4 : next === 'v5' ? 5 : undefined })}
              info={socketioRowInfo('socketioProtocol')}
              options={protocolOptions}
              {...rows.field(
                'socketioProtocol',
                value.socketioProtocol,
                t('workbench.editors.websocket.settings.socketioProtocolPlaceholder'),
                protocolLabel,
              )}
              modified={value.socketioProtocol !== undefined}
              unsaved={isUnsaved('socketioProtocol')}
              testId="websocket-socketio-protocol"
            />
            <ComboKnobRow
              label={t('workbench.editors.websocket.settings.ackTimeoutLabel')}
              value={value.ackTimeoutMs}
              onChange={(ackTimeoutMs) => set({ ackTimeoutMs })}
              info={socketioRowInfo('ackTimeout')}
              presets={TIMEOUT_PRESETS}
              interpret={interpretTimeout}
              format={formatDurationMs}
              {...rows.field(
                'ackTimeoutMs',
                value.ackTimeoutMs,
                t('workbench.editors.websocket.settings.ackTimeoutPlaceholder'),
                formatDurationMs,
              )}
              unsaved={isUnsaved('ackTimeoutMs')}
              testId="websocket-ack-timeout"
            />
          </GroupSection>
        )}
        <TlsTrustGroup
          groupLabel={t(WS_GROUP_LABEL_KEY.tls)}
          groupInfo={groupInfo('tls')}
          expanded={collapsed.tls !== true}
          onToggle={() => toggleGroup('tls')}
          value={value}
          onChange={(next) => set(next)}
          rowInfo={rowInfo}
          unsaved={unsaved}
          inherited={inherited}
          trustedRootsRow={!container}
          testIdPrefix="websocket"
        />
        {!container && (
          <RuntimeManagedSheet
            runtime={runtime}
            rows={managedRows}
            groupOrder={WS_GROUP_ORDER}
            groupLabel={(group) => t(WS_GROUP_LABEL_KEY[group])}
            groupInfo={groupInfo}
            expanded={(group) => collapsed[`sheet-${group}`] !== true}
            onToggle={(group) => toggleGroup(`sheet-${group}`)}
          />
        )}
      </div>
    </ConfigProvider>
  );
};

export default WebSocketSettingsRows;
