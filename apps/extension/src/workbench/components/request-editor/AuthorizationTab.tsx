/**
 * AuthorizationTab — two-column layout. Left rail: auth-type picker +
 * contextual note. Right pane: auth-type-specific form.
 *
 * The wire-level `credentialsMode` (cookie-jar policy) lives under
 * the Settings tab now — this tab focuses purely on how the
 * Authorization header is assembled.
 */

import { findOAuth2Preset, OAUTH2_PROVIDER_PRESETS } from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';
import { Input, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import OAuth2AuthEditor from '../OAuth2AuthEditor';

const { Text } = Typography;

type AuthKind = V5.AuthConfig['type'];

interface AuthOption {
  value: AuthKind;
  label: string;
}

const AUTH_OPTIONS: AuthOption[] = [
  { value: 'inherit', label: 'Inherit auth from parent' },
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
];

interface AuthorizationTabProps {
  auth: V5.AuthConfig;
  onChange: (auth: V5.AuthConfig) => void;
}

const AuthorizationTab: React.FC<AuthorizationTabProps> = ({ auth, onChange }) => {
  const { token } = theme.useToken();

  const switchType = (type: AuthKind) => {
    if (type === 'none' || type === 'inherit') {
      onChange({ type });
    } else if (type === 'basic') {
      onChange({ type: 'basic', username: '', password: '' });
    } else if (type === 'bearer') {
      onChange({ type: 'bearer', token: '' });
    } else if (type === 'api-key') {
      onChange({ type: 'api-key', key: '', value: '', in: 'header' });
    } else if (type === 'oauth2') {
      const credentialRef = `oauth2-cred-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      onChange({
        type: 'oauth2',
        credentialRef,
        flow: 'authorization-code-pkce',
        tokenEndpoint: '',
        clientId: '',
        scopes: [],
      });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 32, minHeight: 320 }}>
      {/* Left rail — sticks to the top of the scroll container so the
          auth-type picker stays visible while the right pane's long
          OAuth 2.0 form scrolls past it. `align-self: start` keeps
          the rail content-sized so `position: sticky` has something
          to anchor against; without it the grid cell stretches to the
          row's full height and sticky collapses to a no-op. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          position: 'sticky',
          top: 0,
          alignSelf: 'start',
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          Auth Type
        </Text>
        <Select
          size="middle"
          value={auth.type}
          onChange={switchType}
          options={AUTH_OPTIONS}
          style={{ width: '100%' }}
        />
        {auth.type === 'inherit' && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            The authorization data will be automatically configured based on the parent collection.
          </Text>
        )}
        {auth.type === 'none' && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            This request does not use any authorization.
          </Text>
        )}
        {auth.type === 'oauth2' && <OAuth2LeftRailControls auth={auth} onChange={onChange} />}
      </div>

      {/* Right pane */}
      <div
        style={{
          paddingLeft: 24,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          minWidth: 0,
        }}
      >
        {auth.type === 'none' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: token.colorTextTertiary,
              gap: 8,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                background: token.colorFillTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: token.colorTextSecondary,
              }}
            >
              —
            </div>
            <Text strong style={{ fontSize: 14 }}>
              No Auth
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              This request does not use any authorization.
            </Text>
          </div>
        )}

        {auth.type === 'inherit' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: token.colorTextTertiary,
              gap: 8,
            }}
          >
            <Text strong style={{ fontSize: 14 }}>
              Inherit auth from parent
            </Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
              This request is using the authorization helper from its parent collection. Edit the collection's
              Authorization tab to change it.
            </Text>
          </div>
        )}

        {auth.type === 'basic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 540 }}>
            <LabeledRow label="Username">
              <Input
                size="small"
                value={auth.username}
                onChange={(e) => onChange({ ...auth, username: e.target.value })}
                placeholder="username"
              />
            </LabeledRow>
            <LabeledRow label="Password">
              <Input.Password
                size="small"
                value={auth.password}
                onChange={(e) => onChange({ ...auth, password: e.target.value })}
                placeholder="password"
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 540 }}>
            <LabeledRow label="Token">
              <Input
                size="small"
                value={auth.token}
                onChange={(e) => onChange({ ...auth, token: e.target.value })}
                placeholder="bearer token"
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'api-key' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 540 }}>
            <LabeledRow label="Key">
              <Input
                size="small"
                value={auth.key}
                onChange={(e) => onChange({ ...auth, key: e.target.value })}
                placeholder="e.g. X-API-Key"
              />
            </LabeledRow>
            <LabeledRow label="Value">
              <Input
                size="small"
                value={auth.value}
                onChange={(e) => onChange({ ...auth, value: e.target.value })}
                placeholder="api key value"
              />
            </LabeledRow>
            <LabeledRow label="Add to">
              <Select
                size="small"
                value={auth.in}
                onChange={(next: 'header' | 'query') => onChange({ ...auth, in: next })}
                options={[
                  { value: 'header', label: 'Header' },
                  { value: 'query', label: 'Query Params' },
                ]}
                style={{ width: '100%' }}
              />
            </LabeledRow>
          </div>
        )}

        {auth.type === 'oauth2' && <OAuth2AuthEditor auth={auth} onChange={onChange} />}
      </div>
    </div>
  );
};

// ── OAuth2 left-rail controls ─────────────────────────────────────
//
// When OAuth 2.0 is the active auth type, the rail grows two extra
// selectors below the Auth Type dropdown:
//   • "Add authorization data to" — header (Authorization: Bearer …)
//     vs query (?access_token=…). Query is deprecated per RFC 6750
//     but still honored for legacy providers; a warning surfaces in
//     the right pane when selected.
//   • "Provider preset"           — pre-fills endpoints + default
//     scopes from the core preset library.

const OAuth2LeftRailControls: React.FC<{
  auth: Extract<V5.AuthConfig, { type: 'oauth2' }>;
  onChange: (auth: V5.AuthConfig) => void;
}> = ({ auth, onChange }) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          Add authorization data to
        </Text>
        <Select
          size="middle"
          value={auth.sendAs ?? 'header'}
          onChange={(next: 'header' | 'query') => onChange({ ...auth, sendAs: next })}
          options={[
            { value: 'header', label: 'Request Headers' },
            { value: 'query', label: 'Request URL' },
          ]}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          Provider preset
        </Text>
        <Select
          size="middle"
          value={auth.providerPresetId ?? 'custom'}
          onChange={applyPreset}
          options={[
            { value: 'custom', label: 'Custom (no preset)' },
            ...OAUTH2_PROVIDER_PRESETS.map((p) => ({ value: p.id, label: p.label })),
          ]}
          style={{ width: '100%' }}
        />
        <Text type="secondary" style={{ fontSize: 11 }}>
          Pre-fills endpoints + default scopes. Custom = configure manually.
        </Text>
      </div>
    </div>
  );
};

// ── Shared row ─────────────────────────────────────────────────────

const LabeledRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', gap: 16 }}>
    <Text style={{ fontSize: 13 }}>{label}</Text>
    <div>{children}</div>
  </div>
);

export default AuthorizationTab;
