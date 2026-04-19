/**
 * OAuth2AuthEditor — inline OAuth 2.0 / OIDC configuration inside
 * the Request Editor's Auth tab (ARCHITECTURE §18).
 *
 * Surfaces the stable redirect URI (copy-button), a provider preset
 * dropdown, endpoints + client id/secret, scopes (chip input), flow
 * picker, and an Authorize/Refresh/Disconnect action bar. The "Connected"
 * badge reflects the live token bundle for this config's
 * `credentialRef` and updates via the `oauthTokensChanged` broadcast.
 */

import {
  CheckCircleFilled,
  CopyOutlined,
  DeleteOutlined,
  LoadingOutlined,
  ReloadOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { useOAuth } from '@hooks/useOAuth';
import { findOAuth2Preset, isExpired, OAUTH2_PROVIDER_PRESETS, secondsUntilExpiry } from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Input, Select, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';

const { Text } = Typography;

type OAuth2Auth = V5.OAuth2Auth;
type OAuth2Flow = V5.OAuth2Flow;

const FLOW_OPTIONS: { value: OAuth2Flow; label: string; description: string }[] = [
  {
    value: 'authorization-code-pkce',
    label: 'Authorization Code + PKCE',
    description: 'User consent; opens a provider login window.',
  },
  {
    value: 'client-credentials',
    label: 'Client Credentials',
    description: 'Machine-to-machine. Requires a client secret.',
  },
  {
    value: 'device-code',
    label: 'Device Code',
    description: 'CLI parity — user enters a short code on another device.',
  },
];

interface OAuth2AuthEditorProps {
  auth: OAuth2Auth;
  onChange: (auth: OAuth2Auth) => void;
}

const OAuth2AuthEditor: React.FC<OAuth2AuthEditorProps> = ({ auth, onChange }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { tokens, redirectUri, authorize, clientCredentials, refresh, revoke } = useOAuth();
  const [busy, setBusy] = useState<null | 'authorize' | 'refresh' | 'revoke'>(null);

  const bundle = tokens[auth.credentialRef] ?? null;
  const expired = bundle ? isExpired(bundle) : false;

  const applyPreset = useCallback(
    (presetId: string) => {
      if (presetId === 'custom') {
        onChange({ ...auth, providerPresetId: undefined });
        return;
      }
      const preset = findOAuth2Preset(presetId);
      if (!preset) return;
      onChange({
        ...auth,
        providerPresetId: preset.id,
        authorizationEndpoint: preset.authorizationEndpoint,
        tokenEndpoint: preset.tokenEndpoint,
        deviceAuthorizationEndpoint: preset.deviceAuthorizationEndpoint ?? auth.deviceAuthorizationEndpoint,
        scopes: [...preset.defaultScopes],
        flow: preset.defaultFlow,
      });
    },
    [auth, onChange],
  );

  const handleAuthorize = async () => {
    setBusy('authorize');
    try {
      if (auth.flow === 'client-credentials') {
        const res = await clientCredentials(auth);
        if (res.success) message.success('OAuth: client-credentials token received');
        else message.error(`OAuth failed: ${res.error}`);
      } else {
        const res = await authorize(auth);
        if (res.success) message.success('OAuth: authorization complete');
        else message.error(`OAuth failed: ${res.error}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy('refresh');
    try {
      const res = await refresh(auth);
      if (res.success) message.success('OAuth: access token refreshed');
      else message.error(`Refresh failed: ${res.error}`);
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async () => {
    setBusy('revoke');
    try {
      const removed = await revoke(auth.credentialRef);
      if (removed) message.success('OAuth: disconnected');
      else message.info('Nothing to disconnect — no stored token');
    } finally {
      setBusy(null);
    }
  };

  const handleCopyRedirect = async () => {
    if (!redirectUri) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
      message.success('Redirect URI copied');
    } catch {
      message.warning('Copy not supported — select the URL manually');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
      <ConnectionBadge bundle={bundle} expired={expired} />

      {/* Provider preset */}
      <LabeledField label="Provider">
        <Select
          size="small"
          style={{ width: '100%' }}
          value={auth.providerPresetId ?? 'custom'}
          onChange={applyPreset}
          options={[
            { value: 'custom', label: 'Custom (no preset)' },
            ...OAUTH2_PROVIDER_PRESETS.map((p) => ({ value: p.id, label: p.label })),
          ]}
        />
      </LabeledField>

      {/* Flow */}
      <LabeledField label="Flow" hint={FLOW_OPTIONS.find((f) => f.value === auth.flow)?.description}>
        <Select
          size="small"
          style={{ width: '100%' }}
          value={auth.flow}
          onChange={(flow: OAuth2Flow) => onChange({ ...auth, flow })}
          options={FLOW_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
        />
      </LabeledField>

      {/* Redirect URI */}
      <LabeledField
        label="Redirect URI"
        hint="Register this EXACT string as an allowed redirect URI at your OAuth provider. Stable across extension reloads because the extension ID is pinned."
      >
        <Input
          size="small"
          readOnly
          value={redirectUri ?? 'Detecting…'}
          addonAfter={
            <Tooltip title="Copy">
              <CopyOutlined onClick={handleCopyRedirect} />
            </Tooltip>
          }
        />
      </LabeledField>

      {/* Endpoints */}
      {auth.flow !== 'client-credentials' && (
        <LabeledField label="Authorization Endpoint">
          <Input
            size="small"
            placeholder="https://accounts.example.com/oauth2/authorize"
            value={auth.authorizationEndpoint ?? ''}
            onChange={(e) => onChange({ ...auth, authorizationEndpoint: e.target.value || undefined })}
          />
        </LabeledField>
      )}
      <LabeledField label="Token Endpoint">
        <Input
          size="small"
          placeholder="https://accounts.example.com/oauth2/token"
          value={auth.tokenEndpoint}
          onChange={(e) => onChange({ ...auth, tokenEndpoint: e.target.value })}
        />
      </LabeledField>
      {auth.flow === 'device-code' && (
        <LabeledField label="Device Authorization Endpoint">
          <Input
            size="small"
            placeholder="https://accounts.example.com/oauth2/device/code"
            value={auth.deviceAuthorizationEndpoint ?? ''}
            onChange={(e) => onChange({ ...auth, deviceAuthorizationEndpoint: e.target.value || undefined })}
          />
        </LabeledField>
      )}

      {/* Client credentials */}
      <LabeledField label="Client ID">
        <Input
          size="small"
          placeholder="your OAuth client id"
          value={auth.clientId}
          onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
        />
      </LabeledField>
      <LabeledField
        label="Client Secret"
        hint={
          auth.flow === 'client-credentials'
            ? 'Required — client-credentials flow needs the secret.'
            : 'Optional for public (PKCE) clients. Leave blank unless your provider requires it.'
        }
      >
        <Input.Password
          size="small"
          placeholder={auth.flow === 'client-credentials' ? 'required' : 'optional'}
          value={auth.clientSecret ?? ''}
          onChange={(e) => onChange({ ...auth, clientSecret: e.target.value || undefined })}
        />
      </LabeledField>

      {/* Scopes */}
      <LabeledField
        label="Scopes"
        hint="Space-separated on the wire. Click × to remove a scope; type a new one and press Enter to add."
      >
        <Select
          mode="tags"
          size="small"
          style={{ width: '100%' }}
          tokenSeparators={[' ', ',']}
          value={auth.scopes}
          onChange={(scopes: string[]) => onChange({ ...auth, scopes })}
          placeholder="e.g. openid profile email"
        />
      </LabeledField>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button
          type="primary"
          size="small"
          icon={busy === 'authorize' ? <LoadingOutlined /> : null}
          disabled={busy !== null}
          onClick={() => void handleAuthorize()}
        >
          {bundle ? 'Re-authorize' : 'Authorize'}
        </Button>
        {bundle?.refreshToken && (
          <Button
            size="small"
            icon={busy === 'refresh' ? <LoadingOutlined /> : <ReloadOutlined />}
            disabled={busy !== null}
            onClick={() => void handleRefresh()}
          >
            Refresh
          </Button>
        )}
        {bundle && (
          <Button
            size="small"
            danger
            icon={busy === 'revoke' ? <LoadingOutlined /> : <DeleteOutlined />}
            disabled={busy !== null}
            onClick={() => void handleRevoke()}
          >
            Disconnect
          </Button>
        )}
      </div>

      <Text type="secondary" style={{ fontSize: 11, color: token.colorTextTertiary }}>
        Tokens are stored per workspace under <code>{auth.credentialRef}</code>. Delete the workspace to purge. The
        executor refreshes expired access tokens automatically before each send as long as a refresh_token is available.
      </Text>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────

interface LabeledFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

const LabeledField: React.FC<LabeledFieldProps> = ({ label, hint, children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Text strong style={{ fontSize: 11 }}>
        {label}
      </Text>
      {children}
      {hint && (
        <Text type="secondary" style={{ fontSize: 10 }}>
          {hint}
        </Text>
      )}
    </div>
  );
};

interface ConnectionBadgeProps {
  bundle: import('@openheaders/core/oauth').OAuth2TokenBundle | null;
  expired: boolean;
}

const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ bundle, expired }) => {
  if (!bundle) {
    return (
      <Tag color="default" style={{ width: 'fit-content' }}>
        Not connected
      </Tag>
    );
  }
  const remaining = secondsUntilExpiry(bundle);
  if (expired) {
    return (
      <Space size={4}>
        <Tag icon={<WarningFilled />} color="warning">
          Token expired
        </Tag>
        {bundle.refreshToken && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            — auto-refresh on next send
          </Text>
        )}
      </Space>
    );
  }
  return (
    <Space size={4}>
      <Tag icon={<CheckCircleFilled />} color="success">
        Connected
      </Tag>
      {remaining != null && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          expires in {formatDuration(remaining)}
        </Text>
      )}
      {bundle.scope && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          · scope: {bundle.scope}
        </Text>
      )}
    </Space>
  );
};

function formatDuration(seconds: number): string {
  if (seconds < 0) return 'expired';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86_400)}d`;
}

export default OAuth2AuthEditor;
