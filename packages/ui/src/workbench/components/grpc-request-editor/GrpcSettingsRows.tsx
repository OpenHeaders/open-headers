/**
 * GrpcSettingsRows — the gRPC Settings rows over a props-driven VALUE
 * (the kind's inheritable knobs plus the request-only `:authority`
 * override), rendered by two hosts: the request's Settings tab
 * (`GrpcSettingsTab`, which maps its draft to the value and back, the
 * verification switch concrete on the draft) and a collection's /
 * folder's Settings section (the `grpc` sub-tab over the container's
 * one `settings` object). Same groups, same rows, same (i) copy in
 * both — the lift, never a copy.
 *
 * Groups: Connection · TLS & trust · Messages (request only — the
 * app-wide send-invalid-message posture, neither dot nor reset) and,
 * on node runtimes, the runtime-managed sheet (request only). A
 * container never shows the `:authority` row (target naming,
 * request-only). On the ancestor plane (`inherited`) the rows read
 * their placeholders off the chain and dot any own value.
 */

import { getCapability, type RequestRuntimeKind } from '@openheaders/core/capabilities';
import {
  isValidUnixSocketPath,
  MAX_GRPC_URL_LENGTH,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  MAX_UNIX_SOCKET_PATH_LENGTH,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_RESPONSE_BYTES,
} from '@openheaders/core/schemas';
import type { KindSettings } from '@openheaders/core/settings-inheritance';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  byteSizeInterpreter,
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
  TextKnobRow,
} from '@openheaders/ui/shared/settings-rows';
import { ConfigProvider, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import DialRows, { isDialModified } from '../shared/dial/DialRows';
import { type InheritedSettingsView, inheritedRowsFor } from '../shared/inherited-settings/inherited-settings';
import TlsTrustGroup from '../shared/tls-trust/TlsTrustGroup';
import {
  type GrpcExampleToken,
  grpcExampleCard,
  grpcSettingsGroupInfo,
  grpcSettingsRowInfo,
} from './GrpcSettingsRowInfo';
import { GRPC_GROUP_LABEL_KEY, GRPC_GROUP_ORDER, type GrpcSettingsGroupKey } from './settings-groups';

/** The rows' value: the kind's inheritable knobs (every key optional,
 *  `undefined` = inherit or the runtime default) plus the request-only
 *  authority a container never carries. */
export interface GrpcSettingsValue extends KindSettings<'grpc'> {
  authority?: string | undefined;
}

const CONNECTION_KEYS = [
  'resolveToAddress',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'timeoutMs',
  'maxResponseBytes',
  'keepaliveIntervalMs',
  'keepaliveTimeoutMs',
] as const;

/** The call timeout is app milliseconds on the wire — free text
 *  becomes concrete candidates ("30" → "30 ms" / "30 s"); readings
 *  outside the field's range stay visible as disabled entries naming
 *  the violated bound. */
const interpretTimeout = durationMsInterpreter({ min: MIN_REQUEST_TIMEOUT_MS, max: MAX_REQUEST_TIMEOUT_MS });
const TIMEOUT_PRESETS = numericPresets([1_000, 5_000, 10_000, 30_000, 60_000], formatDurationMs);
const interpretResponseSize = byteSizeInterpreter({ min: MIN_RESPONSE_BYTES, max: MAX_RESPONSE_BYTES });
const SIZE_PRESETS = numericPresets(
  [256, 512, 1024, 2048, 5120, 10240].map((kb) => kb * 1024),
  formatByteSize,
);
/** Keepalive cadence presets start at the floor gRPC servers permit
 *  without data flowing (10 s is the reference client minimum; 5 min
 *  the reference server floor); the timeout presets bracket the
 *  reference 20 s wait. */
const KEEPALIVE_INTERVAL_PRESETS = numericPresets([10_000, 30_000, 60_000, 300_000], formatDurationMs);
const KEEPALIVE_TIMEOUT_PRESETS = numericPresets([5_000, 10_000, 20_000], formatDurationMs);

/** The facts the channel fixes for every call — the runtime-managed
 *  sheet's rows, node runtimes only (the browser has no gRPC wire),
 *  each naming its slice of the call example card. */
const NODE_MANAGED: (RuntimeManagedRowDef<GrpcSettingsGroupKey> & { tokens: readonly GrpcExampleToken[] })[] = [
  {
    labelKey: 'workbench.editors.request.settings.managed.compression',
    valueKey: 'workbench.editors.request.settings.managed.none',
    descriptionKey: 'workbench.editors.request.settings.managed.compressionGrpcDesc',
    group: 'connection',
    tokens: ['compression'],
    testId: 'grpc-managed-compression',
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.httpVersion',
    valueKey: 'workbench.editors.request.settings.managed.http2',
    descriptionKey: 'workbench.editors.request.settings.managed.httpVersionGrpcDesc',
    group: 'connection',
    tokens: ['h2'],
    testId: 'grpc-managed-http-version',
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.connectionReuse',
    valueKey: 'workbench.editors.request.settings.managed.onePerCall',
    descriptionKey: 'workbench.editors.request.settings.managed.connectionReuseGrpcDesc',
    group: 'connection',
    tokens: ['reuse'],
    testId: 'grpc-managed-connection-reuse',
  },
];
const NODE_SHEET_ROWS = NODE_MANAGED.map(({ tokens, ...def }) => ({ ...def, diagram: grpcExampleCard(tokens) }));

/** Session-scoped memory of the group folds: the rows unmount on
 *  every editor tab switch, and a fold choice must survive that.
 *  Shared by every gRPC surface — a fold is a reading preference, not
 *  per-request state — and deliberately not persisted to disk. */
const sessionCollapsed: Record<string, boolean> = {};

export interface GrpcSettingsRowsProps {
  value: GrpcSettingsValue;
  /** The whole next value — the host merges it into its own draft. */
  onChange: (next: GrpcSettingsValue) => void;
  /** `request` (default): the request's own rows, the Messages group
   *  and the sheet. `container`: the inheritable rows alone. */
  scope?: 'request' | 'container';
  /** The Messages group's app-wide posture (request scope). */
  messages?: { sendInvalidMessage: boolean; onSendInvalidMessageChange: (next: boolean) => void };
  /** Keys whose value differs from the saved baseline; absent = no
   *  such plane. */
  unsaved?: ReadonlySet<string>;
  /** The ancestor plane — see the shared blocks. */
  inherited?: InheritedSettingsView;
}

const GrpcSettingsRows: React.FC<GrpcSettingsRowsProps> = ({
  value,
  onChange,
  scope = 'request',
  messages,
  unsaved,
  inherited,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const runtime: RequestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const container = scope === 'container';
  const rows = inheritedRowsFor(inherited);
  const explicit = inherited !== undefined;
  const isUnsaved = (key: string): boolean => unsaved?.has(key) === true;
  const set = (patch: Partial<GrpcSettingsValue>): void => onChange({ ...value, ...patch });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  // The keepalive timeout rides an interval — the row's own or the
  // inherited one.
  const keepaliveIntervalEffective = value.keepaliveIntervalMs ?? inherited?.settings.keepaliveIntervalMs;
  const connectionModified =
    (!container && value.authority !== undefined) ||
    (explicit
      ? CONNECTION_KEYS.some((key) => value[key] !== undefined)
      : isDialModified(value) ||
        value.unixSocketPath !== undefined ||
        value.timeoutMs !== undefined ||
        value.maxResponseBytes !== undefined ||
        value.keepaliveIntervalMs !== undefined ||
        value.keepaliveTimeoutMs !== undefined);

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
          label={t(GRPC_GROUP_LABEL_KEY.connection)}
          expanded={collapsed.connection !== true}
          onToggle={() => toggleGroup('connection')}
          info={grpcSettingsGroupInfo(t, 'connection')}
          modified={connectionModified}
          unsaved={CONNECTION_KEYS.some(isUnsaved)}
        >
          <DialRows
            groupLabel={t(GRPC_GROUP_LABEL_KEY.connection)}
            value={value}
            onChange={(next) => set(next)}
            rowInfo={(key) => grpcSettingsRowInfo(t, key)}
            unsaved={unsaved}
            inherited={inherited}
            testIdPrefix="grpc"
          />
          <TextKnobRow
            label={t('workbench.editors.grpc.settings.unixSocketLabel')}
            value={value.unixSocketPath}
            onChange={(unixSocketPath) => set({ unixSocketPath })}
            info={grpcSettingsRowInfo(t, 'unixSocket')}
            {...rows.field(
              'unixSocketPath',
              value.unixSocketPath,
              t('workbench.editors.grpc.settings.unixSocketPlaceholder'),
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
            testId="grpc-unix-socket"
          />
          {!container && (
            <TextKnobRow
              label={t('workbench.editors.grpc.settings.authorityLabel')}
              value={value.authority}
              onChange={(authority) => set({ authority })}
              info={grpcSettingsRowInfo(t, 'authority')}
              placeholder={t('workbench.editors.grpc.settings.authorityPlaceholder')}
              maxLength={MAX_GRPC_URL_LENGTH}
              testId="grpc-authority"
            />
          )}
          <ComboKnobRow
            label={t('workbench.editors.grpc.settings.timeoutLabel')}
            value={value.timeoutMs}
            onChange={(timeoutMs) => set({ timeoutMs })}
            info={grpcSettingsRowInfo(t, 'timeout')}
            presets={TIMEOUT_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            {...rows.field(
              'timeoutMs',
              value.timeoutMs,
              t('workbench.editors.grpc.settings.timeoutPlaceholder'),
              formatDurationMs,
            )}
            unsaved={isUnsaved('timeoutMs')}
            testId="grpc-timeout"
          />
          <ComboKnobRow
            label={t('workbench.editors.request.settings.responseSizeLimit')}
            value={value.maxResponseBytes}
            onChange={(maxResponseBytes) => set({ maxResponseBytes })}
            info={grpcSettingsRowInfo(t, 'responseSizeLimit')}
            presets={SIZE_PRESETS}
            interpret={interpretResponseSize}
            format={formatByteSize}
            {...rows.field(
              'maxResponseBytes',
              value.maxResponseBytes,
              t('workbench.editors.request.settings.responseSizeLimitPlaceholder'),
              formatByteSize,
            )}
            unsaved={isUnsaved('maxResponseBytes')}
            testId="grpc-response-size-limit"
          />
          <ComboKnobRow
            label={t('workbench.editors.grpc.settings.keepaliveIntervalLabel')}
            value={value.keepaliveIntervalMs}
            onChange={(keepaliveIntervalMs) =>
              set({
                keepaliveIntervalMs,
                // No interval, no wait to name — the timeout rides it.
                ...(keepaliveIntervalMs === undefined ? { keepaliveTimeoutMs: undefined } : {}),
              })
            }
            info={grpcSettingsRowInfo(t, 'keepaliveInterval')}
            presets={KEEPALIVE_INTERVAL_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            {...rows.field(
              'keepaliveIntervalMs',
              value.keepaliveIntervalMs,
              t('workbench.editors.grpc.settings.keepaliveIntervalPlaceholder'),
              formatDurationMs,
            )}
            unsaved={isUnsaved('keepaliveIntervalMs')}
            testId="grpc-keepalive-interval"
          />
          {keepaliveIntervalEffective !== undefined && (
            <ComboKnobRow
              label={t('workbench.editors.grpc.settings.keepaliveTimeoutLabel')}
              value={value.keepaliveTimeoutMs}
              onChange={(keepaliveTimeoutMs) => set({ keepaliveTimeoutMs })}
              info={grpcSettingsRowInfo(t, 'keepaliveTimeout')}
              presets={KEEPALIVE_TIMEOUT_PRESETS}
              interpret={interpretTimeout}
              format={formatDurationMs}
              {...rows.field(
                'keepaliveTimeoutMs',
                value.keepaliveTimeoutMs,
                t('workbench.editors.grpc.settings.keepaliveTimeoutPlaceholder'),
                formatDurationMs,
              )}
              unsaved={isUnsaved('keepaliveTimeoutMs')}
              testId="grpc-keepalive-timeout"
            />
          )}
        </GroupSection>
        <TlsTrustGroup
          groupLabel={t(GRPC_GROUP_LABEL_KEY.tls)}
          groupInfo={grpcSettingsGroupInfo(t, 'tls')}
          expanded={collapsed.tls !== true}
          onToggle={() => toggleGroup('tls')}
          value={value}
          onChange={(next) => set(next)}
          rowInfo={(key) => grpcSettingsRowInfo(t, key)}
          unsaved={unsaved}
          inherited={inherited}
          trustedRootsRow={!container}
          testIdPrefix="grpc"
        />
        {messages !== undefined && !container && (
          <GroupSection
            label={t(GRPC_GROUP_LABEL_KEY.messages)}
            expanded={collapsed.messages !== true}
            onToggle={() => toggleGroup('messages')}
            info={grpcSettingsGroupInfo(t, 'messages')}
          >
            <KnobRow
              label={t('workbench.editors.grpc.settings.sendInvalidMessageLabel')}
              checked={messages.sendInvalidMessage}
              onChange={messages.onSendInvalidMessageChange}
              info={grpcSettingsRowInfo(t, 'sendInvalidMessage')}
              testId="grpc-send-invalid-message"
            />
          </GroupSection>
        )}
        {!container && (
          <RuntimeManagedSheet
            runtime={runtime}
            rows={runtime === 'node' ? NODE_SHEET_ROWS : []}
            groupOrder={GRPC_GROUP_ORDER}
            groupLabel={(group) => t(GRPC_GROUP_LABEL_KEY[group])}
            groupInfo={(group) => grpcSettingsGroupInfo(t, group)}
            expanded={(group) => collapsed[`sheet-${group}`] !== true}
            onToggle={(group) => toggleGroup(`sheet-${group}`)}
          />
        )}
      </div>
    </ConfigProvider>
  );
};

export default GrpcSettingsRows;
