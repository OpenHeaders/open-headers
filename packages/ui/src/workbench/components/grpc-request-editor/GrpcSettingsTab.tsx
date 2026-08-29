/**
 * GrpcSettingsTab — per-request call knobs in the request Settings
 * tab's exact anatomy (the MQTT and WebSocket Settings tabs'
 * discipline): collapsible group sections (Connection · TLS & trust ·
 * Messages) whose headers carry the (i) group popovers, `label · (i)
 * · control` rows from the shared settings-row family with the
 * effective defaults legible in the controls, modified dots, and
 * per-row resets; the Connection group opens on the shared `DialRows`
 * block and closes on the response size limit (the HTTP request's
 * cap on the channel's body), the TLS & trust group is the shared
 * `TlsTrustGroup` block. On node runtimes the runtime-managed sheet
 * under the groups states what the channel fixes: no compression,
 * HTTP/2 only.
 *
 * The tab edits the draft directly, so the dots track distance from
 * the PROTOCOL defaults — there is no saved-baseline (unsaved) plane
 * here; the editor's own dirty fingerprint covers "not saved yet".
 * The call timeout states "No limit" honestly: no layer arms a
 * deadline unless the request carries one. The Messages group holds
 * the app-wide send-invalid-message posture — the SAME setting as
 * Settings → Requests and the header ⋯ toggle, not a per-request
 * field, so it wears neither dot nor reset.
 */

import { getCapability, type RequestRuntimeKind } from '@openheaders/core/capabilities';
import {
  isValidUnixSocketPath,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  MAX_UNIX_SOCKET_PATH_LENGTH,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_RESPONSE_BYTES,
} from '@openheaders/core/schemas';
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
import type { Dispatch, SetStateAction } from 'react';
import DialRows, { isDialModified } from '../shared/dial/DialRows';
import TlsTrustGroup from '../shared/tls-trust/TlsTrustGroup';
import type { GrpcDraft } from './draft';
import { grpcSettingsGroupInfo, grpcSettingsRowInfo } from './GrpcSettingsRowInfo';
import { GRPC_GROUP_LABEL_KEY, GRPC_GROUP_ORDER, type GrpcSettingsGroupKey } from './settings-groups';

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

/** The facts the channel fixes for every call — the runtime-managed
 *  sheet's rows, node runtimes only (the browser has no gRPC wire). */
const NODE_MANAGED: RuntimeManagedRowDef<GrpcSettingsGroupKey>[] = [
  {
    labelKey: 'workbench.editors.request.settings.managed.compression',
    valueKey: 'workbench.editors.request.settings.managed.none',
    descriptionKey: 'workbench.editors.request.settings.managed.compressionGrpcDesc',
    group: 'connection',
    testId: 'grpc-managed-compression',
  },
  {
    labelKey: 'workbench.editors.request.settings.managed.httpVersion',
    valueKey: 'workbench.editors.request.settings.managed.http2',
    descriptionKey: 'workbench.editors.request.settings.managed.httpVersionGrpcDesc',
    group: 'connection',
    testId: 'grpc-managed-http-version',
  },
];

/** Session-scoped memory of the group folds: the tab unmounts on
 *  every editor tab switch, and a fold choice must survive that.
 *  Shared by every gRPC editor — a fold is a reading preference, not
 *  per-request state — and deliberately not persisted to disk. */
const sessionCollapsed: Record<string, boolean> = {};

interface GrpcSettingsTabProps {
  draft: GrpcDraft;
  setDraft: Dispatch<SetStateAction<GrpcDraft>>;
  sendInvalidMessage: boolean;
  onSendInvalidMessageChange: (next: boolean) => void;
}

const GrpcSettingsTab: React.FC<GrpcSettingsTabProps> = ({
  draft,
  setDraft,
  sendInvalidMessage,
  onSendInvalidMessageChange,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const runtime: RequestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  const connectionModified =
    isDialModified(draft) ||
    draft.unixSocketPath !== undefined ||
    draft.timeoutMs !== undefined ||
    draft.maxResponseBytes !== undefined;

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
        >
          <DialRows
            groupLabel={t(GRPC_GROUP_LABEL_KEY.connection)}
            value={draft}
            onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
            testIdPrefix="grpc"
          />
          <TextKnobRow
            label={t('workbench.editors.grpc.settings.unixSocketLabel')}
            value={draft.unixSocketPath}
            onChange={(unixSocketPath) => setDraft((d) => ({ ...d, unixSocketPath }))}
            info={grpcSettingsRowInfo(t, 'unixSocket')}
            placeholder={t('workbench.editors.grpc.settings.unixSocketPlaceholder')}
            maxLength={MAX_UNIX_SOCKET_PATH_LENGTH}
            error={
              draft.unixSocketPath !== undefined && !isValidUnixSocketPath(draft.unixSocketPath)
                ? t('workbench.editors.request.settings.unixSocketError')
                : undefined
            }
            example={t('workbench.editors.request.settings.unixSocketExample')}
            testId="grpc-unix-socket"
          />
          <ComboKnobRow
            label={t('workbench.editors.grpc.settings.timeoutLabel')}
            value={draft.timeoutMs}
            onChange={(timeoutMs) => setDraft((d) => ({ ...d, timeoutMs }))}
            info={grpcSettingsRowInfo(t, 'timeout')}
            presets={TIMEOUT_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            placeholder={t('workbench.editors.grpc.settings.timeoutPlaceholder')}
            testId="grpc-timeout"
          />
          <ComboKnobRow
            label={t('workbench.editors.request.settings.responseSizeLimit')}
            value={draft.maxResponseBytes}
            onChange={(maxResponseBytes) => setDraft((d) => ({ ...d, maxResponseBytes }))}
            info={grpcSettingsRowInfo(t, 'responseSizeLimit')}
            presets={SIZE_PRESETS}
            interpret={interpretResponseSize}
            format={formatByteSize}
            placeholder={t('workbench.editors.request.settings.responseSizeLimitPlaceholder')}
            testId="grpc-response-size-limit"
          />
        </GroupSection>
        <TlsTrustGroup
          groupLabel={t(GRPC_GROUP_LABEL_KEY.tls)}
          groupInfo={grpcSettingsGroupInfo(t, 'tls')}
          expanded={collapsed.tls !== true}
          onToggle={() => toggleGroup('tls')}
          value={draft}
          onChange={(next) => setDraft((d) => ({ ...d, ...next, sslVerification: next.sslVerification !== false }))}
          testIdPrefix="grpc"
        />
        <GroupSection
          label={t(GRPC_GROUP_LABEL_KEY.messages)}
          expanded={collapsed.messages !== true}
          onToggle={() => toggleGroup('messages')}
          info={grpcSettingsGroupInfo(t, 'messages')}
        >
          <KnobRow
            label={t('workbench.editors.grpc.settings.sendInvalidMessageLabel')}
            checked={sendInvalidMessage}
            onChange={onSendInvalidMessageChange}
            info={grpcSettingsRowInfo(t, 'sendInvalidMessage')}
            testId="grpc-send-invalid-message"
          />
        </GroupSection>
        <RuntimeManagedSheet
          runtime={runtime}
          rows={runtime === 'node' ? NODE_MANAGED : []}
          groupOrder={GRPC_GROUP_ORDER}
          groupLabel={(group) => t(GRPC_GROUP_LABEL_KEY[group])}
          groupInfo={(group) => grpcSettingsGroupInfo(t, group)}
          expanded={(group) => collapsed[`sheet-${group}`] !== true}
          onToggle={(group) => toggleGroup(`sheet-${group}`)}
        />
      </div>
    </ConfigProvider>
  );
};

export default GrpcSettingsTab;
