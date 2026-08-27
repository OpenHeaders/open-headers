/**
 * WebSocketSettingsTab — per-request connection knobs in the request
 * Settings tab's exact anatomy (the MQTT Settings tab's discipline):
 * collapsible group sections (Connection · Socket.IO · TLS & trust)
 * whose headers carry the (i) group popovers, `label · (i) · control`
 * rows from the shared settings-row family with the effective
 * defaults legible in the controls, modified dots, and per-row
 * resets. The Socket.IO group renders on that flavor only.
 *
 * The tab edits the draft directly, so the dots track distance from
 * the PROTOCOL defaults — there is no saved-baseline (unsaved) plane
 * here; the editor's own dirty fingerprint covers "not saved yet".
 * The connect timeout states "No limit" honestly: no transport arms a
 * dial deadline unless the request carries one.
 */

import {
  isValidUnixSocketPath,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_UNIX_SOCKET_PATH_LENGTH,
  MIN_REQUEST_TIMEOUT_MS,
} from '@openheaders/core/schemas';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { durationMsInterpreter, formatDurationMs, numericPresets } from '@openheaders/ui/shared/combo-knob';
import { ComboKnobRow, GroupSection, KnobRow, TagsKnobRow, TextKnobRow } from '@openheaders/ui/shared/settings-rows';
import { ConfigProvider, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import TrustedRootsSettingsRow from '../trusted-roots/TrustedRootsSettingsRow';
import type { WebSocketDraft } from './draft';
import { WS_GROUP_LABEL_KEY } from './settings-groups';
import { wsSettingsGroupInfo, wsSettingsRowInfo } from './WebSocketSettingsRowInfo';

/** The Socket.IO namespace is a URL path segment; cap it generously. */
const MAX_NAMESPACE_LENGTH = 256;

/** The connect timeout is app milliseconds on the wire — free text
 *  becomes concrete candidates ("30" → "30 ms" / "30 s"); readings
 *  outside the field's range stay visible as disabled entries naming
 *  the violated bound. */
const interpretTimeout = durationMsInterpreter({ min: MIN_REQUEST_TIMEOUT_MS, max: MAX_REQUEST_TIMEOUT_MS });
const TIMEOUT_PRESETS = numericPresets([1_000, 5_000, 10_000, 30_000, 60_000], formatDurationMs);

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({ ...sessionCollapsed }));
  const toggleGroup = (key: string): void =>
    setCollapsed((c) => {
      const next = !(c[key] ?? false);
      sessionCollapsed[key] = next;
      return { ...c, [key]: next };
    });
  const connectionModified =
    draft.subprotocols.length > 0 || draft.unixSocketPath !== undefined || draft.timeoutMs !== undefined;
  const socketioModified = draft.namespace !== '';
  const tlsModified = !draft.sslVerification;

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
          info={wsSettingsGroupInfo(t, 'connection')}
          modified={connectionModified}
        >
          <TagsKnobRow
            label={t('workbench.editors.websocket.settings.subprotocolsLabel')}
            value={draft.subprotocols}
            onChange={(subprotocols) => setDraft((d) => ({ ...d, subprotocols }))}
            info={wsSettingsRowInfo(t, 'subprotocols')}
            placeholder={t('workbench.editors.websocket.settings.subprotocolsPlaceholder')}
            example={t('workbench.editors.websocket.settings.subprotocolsExample')}
            testId="websocket-subprotocols"
          />
          <TextKnobRow
            label={t('workbench.editors.websocket.settings.unixSocketLabel')}
            value={draft.unixSocketPath}
            onChange={(unixSocketPath) => setDraft((d) => ({ ...d, unixSocketPath }))}
            info={wsSettingsRowInfo(t, 'unixSocket')}
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
            info={wsSettingsRowInfo(t, 'timeout')}
            presets={TIMEOUT_PRESETS}
            interpret={interpretTimeout}
            format={formatDurationMs}
            placeholder={t('workbench.editors.websocket.settings.timeoutPlaceholder')}
            testId="websocket-timeout"
          />
        </GroupSection>
        {socketioFlavor && (
          <GroupSection
            label={t(WS_GROUP_LABEL_KEY.socketio)}
            expanded={collapsed.socketio !== true}
            onToggle={() => toggleGroup('socketio')}
            info={wsSettingsGroupInfo(t, 'socketio')}
            modified={socketioModified}
          >
            <TextKnobRow
              label={t('workbench.editors.websocket.settings.namespaceLabel')}
              value={draft.namespace === '' ? undefined : draft.namespace}
              onChange={(namespace) => setDraft((d) => ({ ...d, namespace: namespace ?? '' }))}
              info={wsSettingsRowInfo(t, 'namespace')}
              placeholder={t('workbench.editors.websocket.settings.namespacePlaceholder')}
              maxLength={MAX_NAMESPACE_LENGTH}
              example={t('workbench.editors.websocket.settings.namespaceExample')}
              testId="websocket-namespace"
            />
          </GroupSection>
        )}
        <GroupSection
          label={t(WS_GROUP_LABEL_KEY.tls)}
          expanded={collapsed.tls !== true}
          onToggle={() => toggleGroup('tls')}
          info={wsSettingsGroupInfo(t, 'tls')}
          modified={tlsModified}
        >
          <KnobRow
            label={t('workbench.editors.websocket.settings.sslVerifyLabel')}
            checked={draft.sslVerification}
            modified={!draft.sslVerification}
            onReset={() => setDraft((d) => ({ ...d, sslVerification: true }))}
            onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
            info={wsSettingsRowInfo(t, 'sslVerification')}
            warning={t('workbench.editors.websocket.settings.sslVerifyWarning')}
            testId="websocket-ssl-verify"
          />
          <TrustedRootsSettingsRow kicker={t(WS_GROUP_LABEL_KEY.tls)} testId="websocket-trusted-roots" />
        </GroupSection>
      </div>
    </ConfigProvider>
  );
};

export default WebSocketSettingsTab;
