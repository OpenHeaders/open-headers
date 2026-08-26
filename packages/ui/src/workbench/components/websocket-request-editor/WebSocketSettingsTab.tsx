/**
 * WebSocketSettingsTab — per-request connection knobs: the Socket.IO
 * namespace (flavor-gated), SSL verification, the subprotocol offer
 * list, the Unix-socket dial and the connect deadline.
 */

import {
  isValidUnixSocketPath,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_UNIX_SOCKET_PATH_LENGTH,
  MIN_REQUEST_TIMEOUT_MS,
} from '@openheaders/core/schemas';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, InputNumber, Select, Switch, Typography } from 'antd';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { WebSocketDraft } from './draft';

const { Text } = Typography;

/** One Settings-tab row — the gRPC editor's SettingRow vocabulary. */
const SettingRow: React.FC<{ label: string; description: string; control: React.ReactNode }> = ({
  label,
  description,
  control,
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, padding: '10px 0' }}>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text strong style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {description}
      </Text>
    </div>
    <div style={{ flexShrink: 0 }}>{control}</div>
  </div>
);

interface WebSocketSettingsTabProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  socketioFlavor: boolean;
}

const WebSocketSettingsTab: React.FC<WebSocketSettingsTabProps> = ({ draft, setDraft, socketioFlavor }) => {
  const t = useT();
  return (
    <div style={{ maxWidth: 720 }}>
      {socketioFlavor && (
        <SettingRow
          label={t('workbench.editors.websocket.settings.namespaceLabel')}
          description={t('workbench.editors.websocket.settings.namespaceHelp')}
          control={
            <Input
              style={{ width: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
              placeholder={t('workbench.editors.websocket.settings.namespacePlaceholder')}
              value={draft.namespace}
              onChange={(e) => setDraft((d) => ({ ...d, namespace: e.target.value }))}
              data-testid="websocket-namespace"
            />
          }
        />
      )}
      <SettingRow
        label={t('workbench.editors.websocket.settings.sslVerifyLabel')}
        description={t('workbench.editors.websocket.settings.sslVerifyHelp')}
        control={
          <Switch
            checked={draft.sslVerification}
            onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
            data-testid="websocket-ssl-verify"
          />
        }
      />
      <SettingRow
        label={t('workbench.editors.websocket.settings.subprotocolsLabel')}
        description={t('workbench.editors.websocket.settings.subprotocolsHelp')}
        control={
          <Select
            mode="tags"
            style={{ minWidth: 260 }}
            value={draft.subprotocols}
            onChange={(subprotocols: string[]) => setDraft((d) => ({ ...d, subprotocols }))}
            placeholder={t('workbench.editors.websocket.settings.subprotocolsPlaceholder')}
            open={false}
            suffixIcon={null}
            tokenSeparators={[',', ' ']}
            data-testid="websocket-subprotocols"
          />
        }
      />
      <SettingRow
        label={t('workbench.editors.websocket.settings.unixSocketLabel')}
        description={t('workbench.editors.websocket.settings.unixSocketHelp')}
        control={
          <Input
            value={draft.unixSocketPath ?? ''}
            onChange={(e) => {
              const next = e.target.value;
              setDraft((d) => ({ ...d, unixSocketPath: next.trim() === '' ? undefined : next }));
            }}
            placeholder={t('workbench.editors.websocket.settings.unixSocketPlaceholder')}
            maxLength={MAX_UNIX_SOCKET_PATH_LENGTH}
            status={
              draft.unixSocketPath !== undefined && !isValidUnixSocketPath(draft.unixSocketPath) ? 'error' : undefined
            }
            style={{ width: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
            data-testid="websocket-unix-socket"
          />
        }
      />
      <SettingRow
        label={t('workbench.editors.websocket.settings.timeoutLabel')}
        description={t('workbench.editors.websocket.settings.timeoutHelp')}
        control={
          <InputNumber
            min={MIN_REQUEST_TIMEOUT_MS}
            max={MAX_REQUEST_TIMEOUT_MS}
            step={1000}
            value={draft.timeoutMs}
            onChange={(value) => setDraft((d) => ({ ...d, timeoutMs: value ?? undefined }))}
            placeholder={t('workbench.editors.websocket.settings.timeoutPlaceholder')}
            style={{ width: 160 }}
            data-testid="websocket-timeout"
          />
        }
      />
    </div>
  );
};

export default WebSocketSettingsTab;
