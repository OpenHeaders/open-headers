/**
 * GrpcSettingsTab — per-request settings rows (unix socket, SSL
 * verification, timeout) plus the app-wide send-invalid-message
 * posture: the SAME setting as Settings → Requests and the header ⋯
 * toggle, not a per-request field.
 */

import {
  isValidUnixSocketPath,
  MAX_REQUEST_TIMEOUT_MS,
  MAX_UNIX_SOCKET_PATH_LENGTH,
  MIN_REQUEST_TIMEOUT_MS,
} from '@openheaders/core/schemas';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, InputNumber, Switch, Typography } from 'antd';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GrpcDraft } from './draft';

const { Text } = Typography;

/** One Settings-tab row: label + description on the left, the control
 *  right-aligned — the HTTP editor tabs' vocabulary at the density of
 *  a per-request settings sheet. */
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
  return (
    <div style={{ maxWidth: 720 }}>
      <SettingRow
        label={t('workbench.editors.grpc.settings.unixSocketLabel')}
        description={t('workbench.editors.grpc.settings.unixSocketHelp')}
        control={
          <Input
            value={draft.unixSocketPath ?? ''}
            onChange={(e) => {
              const next = e.target.value;
              setDraft((d) => ({ ...d, unixSocketPath: next.trim() === '' ? undefined : next }));
            }}
            placeholder={t('workbench.editors.grpc.settings.unixSocketPlaceholder')}
            maxLength={MAX_UNIX_SOCKET_PATH_LENGTH}
            status={
              draft.unixSocketPath !== undefined && !isValidUnixSocketPath(draft.unixSocketPath) ? 'error' : undefined
            }
            style={{ width: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
            data-testid="grpc-unix-socket"
          />
        }
      />
      <SettingRow
        label={t('workbench.editors.grpc.settings.sslVerifyLabel')}
        description={t('workbench.editors.grpc.settings.sslVerifyHelp')}
        control={
          <Switch
            checked={draft.sslVerification}
            onChange={(sslVerification) => setDraft((d) => ({ ...d, sslVerification }))}
            data-testid="grpc-ssl-verify"
          />
        }
      />
      <SettingRow
        label={t('workbench.editors.grpc.settings.timeoutLabel')}
        description={t('workbench.editors.grpc.settings.timeoutHelp')}
        control={
          <InputNumber
            min={MIN_REQUEST_TIMEOUT_MS}
            max={MAX_REQUEST_TIMEOUT_MS}
            step={1000}
            value={draft.timeoutMs}
            onChange={(value) => setDraft((d) => ({ ...d, timeoutMs: value ?? undefined }))}
            placeholder={t('workbench.editors.grpc.settings.timeoutPlaceholder')}
            style={{ width: 160 }}
          />
        }
      />
      <SettingRow
        label={t('workbench.settings.def.requests.grpcSendInvalidMessage.label')}
        description={t('workbench.settings.def.requests.grpcSendInvalidMessage.description')}
        control={
          <Switch
            checked={sendInvalidMessage}
            onChange={onSendInvalidMessageChange}
            data-testid="grpc-send-invalid-message"
          />
        }
      />
    </div>
  );
};

export default GrpcSettingsTab;
