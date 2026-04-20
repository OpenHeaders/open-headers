/**
 * OAuth2AuthEditor — full OAuth 2.0 / OIDC configuration surface
 * (ARCHITECTURE §18). Two stacked regions:
 *
 *   1. "Current Token" — the live bundle tied to this config's
 *      `credentialRef`. Lets the user pick an existing token, override
 *      the Authorization header prefix, toggle "auto-refresh" (the
 *      executor's existing on-send refresh; renderer-facing toggle
 *      only surfaces the behaviour, the executor already does it).
 *
 *   2. "Configure New Token" — the full form for running a fresh
 *      authorize flow: Token Name + Grant Type + Callback URL +
 *      Auth URL + Access Token URL + Client ID + Client Secret +
 *      PKCE Code Challenge Method / Verifier (when grant type is
 *      PKCE) + Scope + State + Client Authentication + collapsible
 *      Advanced (Refresh Token URL + Auth / Token / Refresh request
 *      extra params) + "Get new access token" button.
 *
 * The grant-type dropdown maps UI labels to the V5 flow enum:
 *   • "Authorization Code"            → authorization-code-pkce (+ PKCE off)
 *   • "Authorization Code (With PKCE)" → authorization-code-pkce
 *   • "Implicit"                       → authorization-code-pkce (marked reserved)
 *   • "Password Credentials"           → client-credentials (reserved)
 *   • "Client Credentials"             → client-credentials
 */

import { CopyOutlined, DownOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import { useOAuth } from '@hooks/useOAuth';
import { isExpired, secondsUntilExpiry } from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';
import { Alert, App, Button, Checkbox, Input, Select, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import KeyValueTable, { type KeyValueRow } from './request-editor/KeyValueTable';

const { Text, Link } = Typography;

type OAuth2Auth = V5.OAuth2Auth;

// ── Grant type UI model ───────────────────────────────────────────

type GrantTypeId =
  | 'authorization-code'
  | 'authorization-code-pkce'
  | 'implicit'
  | 'password-credentials'
  | 'client-credentials';

interface GrantTypeDef {
  id: GrantTypeId;
  label: string;
  /** Which fields to render when this grant type is active. */
  fields: {
    callbackUrl: boolean;
    authUrl: boolean;
    accessTokenUrl: boolean;
    clientId: boolean;
    clientSecret: boolean;
    usernamePassword: boolean;
    pkce: boolean;
    scope: boolean;
    state: boolean;
  };
  /** Maps back to the persisted V5 flow. */
  v5Flow: V5.OAuth2Flow;
  /** Note shown when the grant type is partial / reserved. */
  reservedNote?: string;
}

const GRANT_TYPES: GrantTypeDef[] = [
  {
    id: 'authorization-code',
    label: 'Authorization Code',
    fields: {
      callbackUrl: true,
      authUrl: true,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      usernamePassword: false,
      pkce: false,
      scope: true,
      state: true,
    },
    v5Flow: 'authorization-code-pkce',
  },
  {
    id: 'authorization-code-pkce',
    label: 'Authorization Code (With PKCE)',
    fields: {
      callbackUrl: true,
      authUrl: true,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      usernamePassword: false,
      pkce: true,
      scope: true,
      state: true,
    },
    v5Flow: 'authorization-code-pkce',
  },
  {
    id: 'implicit',
    label: 'Implicit',
    fields: {
      callbackUrl: true,
      authUrl: true,
      accessTokenUrl: false,
      clientId: true,
      clientSecret: false,
      usernamePassword: false,
      pkce: false,
      scope: true,
      state: true,
    },
    v5Flow: 'authorization-code-pkce',
    reservedNote: 'Implicit flow is deprecated by the OAuth 2.1 draft; runs as Authorization Code under the hood.',
  },
  {
    id: 'password-credentials',
    label: 'Password Credentials',
    fields: {
      callbackUrl: false,
      authUrl: false,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      usernamePassword: true,
      pkce: false,
      scope: true,
      state: false,
    },
    v5Flow: 'client-credentials',
    reservedNote: 'Password Credentials is deprecated upstream; surfaced for legacy integrations only.',
  },
  {
    id: 'client-credentials',
    label: 'Client Credentials',
    fields: {
      callbackUrl: false,
      authUrl: false,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      usernamePassword: false,
      pkce: false,
      scope: true,
      state: false,
    },
    v5Flow: 'client-credentials',
  },
];

function getGrantType(auth: OAuth2Auth): GrantTypeDef {
  // `auth.grantType` carries the user's UI choice verbatim — prefer it
  // over `flow` so picking e.g. `authorization-code` (without PKCE) or
  // `implicit` round-trips cleanly. Fall back to the `flow` mapping
  // only for legacy rows that never wrote a grantType.
  if (auth.grantType) {
    const match = GRANT_TYPES.find((g) => g.id === auth.grantType);
    if (match) return match;
  }
  if (auth.flow === 'client-credentials') return GRANT_TYPES[4];
  return GRANT_TYPES[1];
}

// ── Component ─────────────────────────────────────────────────────

interface OAuth2AuthEditorProps {
  auth: OAuth2Auth;
  onChange: (auth: OAuth2Auth) => void;
}

const OAuth2AuthEditor: React.FC<OAuth2AuthEditorProps> = ({ auth, onChange }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { tokens, redirectUri, authorize, clientCredentials, refresh, revoke } = useOAuth();
  const [busy, setBusy] = useState<null | 'authorize' | 'refresh' | 'revoke'>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');

  const bundle = tokens[auth.credentialRef] ?? null;
  const expired = bundle ? isExpired(bundle) : false;

  const grantType = useMemo(() => getGrantType(auth), [auth]);

  // ── Grant type swap ─────────────────────────────────────────────
  const onGrantChange = (id: GrantTypeId) => {
    const def = GRANT_TYPES.find((g) => g.id === id);
    if (!def) return;
    // Write BOTH fields: `grantType` preserves the user's UI choice,
    // `flow` drives runtime wire behavior (collapses to the subset
    // the executor handles).
    onChange({ ...auth, grantType: def.id, flow: def.v5Flow });
  };

  // ── Flow runners ────────────────────────────────────────────────
  const handleGetNewToken = async () => {
    setBusy('authorize');
    try {
      if (auth.flow === 'client-credentials') {
        const res = await clientCredentials(auth);
        if (res.success) message.success('OAuth: token received');
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
    } finally {
      setBusy(null);
    }
  };

  const handleCopyRedirect = async () => {
    if (!redirectUri) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
      message.success('Callback URL copied');
    } catch {
      message.warning('Copy not supported — select the URL manually');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {auth.sendAs === 'query' && (
        <Alert
          type="warning"
          showIcon
          message="Sending the access token in the URL is deprecated"
          description={
            <>
              RFC 6750 §2.3 kept the URI query-parameter method available but warns against it: tokens leak into server
              logs, HTTP `Referer` headers, browser history, and intermediary caches. Prefer the default{' '}
              <code>Authorization: Bearer</code> header unless the provider requires the query form.
            </>
          }
        />
      )}

      {/* ── Current Token ────────────────────────────────────────────── */}
      <div>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
          Current Token
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LabeledRow label="Token">
            <Input
              size="small"
              readOnly
              value={bundle ? `${bundle.accessToken.slice(0, 8)}…` : ''}
              placeholder="No token yet — use Get new access token below"
            />
          </LabeledRow>
          <LabeledRow label="Header Prefix">
            <Input size="small" readOnly value={bundle?.tokenType ?? 'Bearer'} />
          </LabeledRow>
          <LabeledRow
            label="Auto-refresh Token"
            description="Your expired token will be auto-refreshed before sending a request."
          >
            <Checkbox
              checked={Boolean(bundle?.refreshToken)}
              disabled
              style={{ marginLeft: 'auto', display: 'block' }}
            />
          </LabeledRow>
          {bundle && (
            <LabeledRow
              label="Status"
              description={
                expired
                  ? 'Expired — next send will auto-refresh when a refresh_token is stored.'
                  : `Valid · ${formatDuration(secondsUntilExpiry(bundle) ?? 0)}`
              }
            >
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {bundle.refreshToken && (
                  <Button size="small" onClick={() => void handleRefresh()} disabled={busy !== null}>
                    Refresh now
                  </Button>
                )}
                <Button size="small" danger onClick={() => void handleRevoke()} disabled={busy !== null}>
                  Disconnect
                </Button>
              </div>
            </LabeledRow>
          )}
        </div>
      </div>

      <Divider />

      {/* ── Configure New Token ──────────────────────────────────────── */}
      <div>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
          Configure New Token
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LabeledRow label="Token Name">
            <Input
              size="small"
              placeholder="Enter a token name…"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
          </LabeledRow>

          <LabeledRow label="Grant type">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={grantType.id}
              onChange={(id: GrantTypeId) => onGrantChange(id)}
              options={GRANT_TYPES.map((g) => ({ value: g.id, label: g.label }))}
            />
          </LabeledRow>

          {grantType.reservedNote && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 152 }}>
              {grantType.reservedNote}
            </Text>
          )}

          {grantType.fields.callbackUrl && (
            <>
              <LabeledRow label="Callback URL">
                <Input
                  size="small"
                  readOnly
                  value={redirectUri ?? 'Detecting…'}
                  suffix={
                    <Tooltip
                      title={
                        <span>
                          Register this URL at your OAuth provider. It looks different from the{' '}
                          <code>chrome-extension://…</code> URL in your address bar because Chrome exposes a dedicated{' '}
                          <code>chromiumapp.org</code> redirect host for <code>chrome.identity.launchWebAuthFlow</code>.
                          The extension ID is the same; only the host + scheme differ.
                        </span>
                      }
                      overlayStyle={{ maxWidth: 380 }}
                    >
                      <InfoCircleOutlined style={{ color: 'rgba(0, 0, 0, 0.45)', cursor: 'help' }} />
                    </Tooltip>
                  }
                  addonAfter={
                    <Tooltip title="Copy">
                      <CopyOutlined onClick={handleCopyRedirect} />
                    </Tooltip>
                  }
                />
              </LabeledRow>
              <div style={{ marginLeft: 152, marginTop: -4 }}>
                <Checkbox disabled checked={false}>
                  Authorize using browser
                </Checkbox>
              </div>
            </>
          )}

          {grantType.fields.authUrl && (
            <LabeledRow label="Auth URL">
              <Input
                size="small"
                placeholder="https://example.com/login/oauth/authorize"
                value={auth.authorizationEndpoint ?? ''}
                onChange={(e) => onChange({ ...auth, authorizationEndpoint: e.target.value || undefined })}
              />
            </LabeledRow>
          )}

          {grantType.fields.accessTokenUrl && (
            <LabeledRow label="Access Token URL">
              <Input
                size="small"
                placeholder="https://example.com/login/oauth/access_token"
                value={auth.tokenEndpoint}
                onChange={(e) => onChange({ ...auth, tokenEndpoint: e.target.value })}
              />
            </LabeledRow>
          )}

          {grantType.fields.clientId && (
            <LabeledRow label="Client ID">
              <Input
                size="small"
                placeholder="Client ID"
                value={auth.clientId}
                onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
              />
            </LabeledRow>
          )}

          {grantType.fields.clientSecret && (
            <LabeledRow label="Client Secret">
              <Input.Password
                size="small"
                placeholder="Client Secret"
                value={auth.clientSecret ?? ''}
                onChange={(e) => onChange({ ...auth, clientSecret: e.target.value || undefined })}
              />
            </LabeledRow>
          )}

          {grantType.fields.usernamePassword && (
            <>
              <LabeledRow label="Username">
                <Input size="small" placeholder="Username" />
              </LabeledRow>
              <LabeledRow label="Password">
                <Input.Password size="small" placeholder="Password" />
              </LabeledRow>
            </>
          )}

          {grantType.fields.pkce && (
            <>
              <LabeledRow label="Code Challenge Method">
                <Select
                  size="small"
                  value="SHA-256"
                  options={[{ value: 'SHA-256', label: 'SHA-256' }]}
                  style={{ width: '100%' }}
                />
              </LabeledRow>
              <LabeledRow label="Code Verifier">
                <Input size="small" placeholder="Automatically generated if left blank" disabled />
              </LabeledRow>
            </>
          )}

          {grantType.fields.scope && (
            <LabeledRow label="Scope">
              <Select
                mode="tags"
                size="small"
                style={{ width: '100%' }}
                tokenSeparators={[' ', ',']}
                value={auth.scopes}
                onChange={(scopes: string[]) => onChange({ ...auth, scopes })}
                placeholder="e.g. read:org"
              />
            </LabeledRow>
          )}

          {grantType.fields.state && (
            <LabeledRow label="State">
              <Input size="small" placeholder="State" disabled value="Automatically generated per authorize request" />
            </LabeledRow>
          )}

          <LabeledRow label="Client Authentication">
            <Select
              size="small"
              value="basic-header"
              options={[
                { value: 'basic-header', label: 'Send as Basic Auth header' },
                { value: 'form-body', label: 'Send client credentials in body' },
              ]}
              style={{ width: '100%' }}
            />
          </LabeledRow>

          {/* ── Advanced (collapsible) ─────────────────────────────── */}
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: token.colorText,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {advancedOpen ? <DownOutlined /> : <RightOutlined />} Advanced
            </button>
            {advancedOpen && (
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: token.colorFillAlter,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  You can add more specific customizations to your OAuth2 requests here.{' '}
                  <Link>Learn more about configuration</Link>.
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                  <LabeledRow label="Refresh Token URL">
                    <Input
                      size="small"
                      placeholder="https://example.com/login/oauth/refresh_token"
                      value={auth.tokenEndpoint}
                      onChange={(e) => onChange({ ...auth, tokenEndpoint: e.target.value })}
                    />
                  </LabeledRow>
                  <ParamsBlock
                    title="Auth Request"
                    entries={auth.extraAuthParams ?? []}
                    onChange={(entries) =>
                      onChange({ ...auth, extraAuthParams: entries.length === 0 ? undefined : entries })
                    }
                  />
                  <ParamsBlock
                    title="Token Request"
                    entries={auth.extraTokenParams ?? []}
                    onChange={(entries) =>
                      onChange({ ...auth, extraTokenParams: entries.length === 0 ? undefined : entries })
                    }
                  />
                  <ParamsBlock
                    title="Refresh Request"
                    entries={[]}
                    onChange={() => {
                      /* Reserved — wires to a dedicated refreshExtraParams field next. */
                    }}
                    disabled
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button
              type="primary"
              size="middle"
              onClick={() => void handleGetNewToken()}
              loading={busy === 'authorize'}
              style={{ background: token.colorWarning, borderColor: token.colorWarning }}
            >
              Get new access token
            </Button>
            {bundle && (
              <Button size="middle" onClick={() => void handleRevoke()} disabled={busy !== null}>
                Clear cookies
              </Button>
            )}
          </div>
        </div>
      </div>

      <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
        Tokens are stored per workspace under <code>{auth.credentialRef}</code>. Delete the workspace to purge.
      </Text>
    </div>
  );
};

// ── Pieces ────────────────────────────────────────────────────────

const LabeledRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'start', gap: 16 }}>
    <div style={{ paddingTop: 4 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      {description && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
          {description}
        </Text>
      )}
    </div>
    <div>{children}</div>
  </div>
);

const Divider: React.FC = () => {
  const { token } = theme.useToken();
  return <div style={{ height: 1, background: token.colorBorderSecondary }} />;
};

interface ParamEntry {
  key: string;
  value: string;
}

let OAUTH_PARAM_UID_COUNTER = 0;
const nextOAuthParamUid = (): string => `op-${++OAUTH_PARAM_UID_COUNTER}`;

/**
 * ParamsBlock — wraps the shared `KeyValueTable` so OAuth2's extra
 * Auth / Token / Refresh parameter lists carry the same chrome as
 * every other key-value surface in the extension (drag, checkbox,
 * Bulk Edit, column-hide menu). The OAuth2 storage shape is
 * deliberately narrow (`{key, value}` entries — no description /
 * enabled on the schema), so the adapter maps onto KeyValueRow and
 * strips the extra fields on commit.
 */
const ParamsBlock: React.FC<{
  title: string;
  entries: ParamEntry[];
  onChange: (entries: ParamEntry[]) => void;
  disabled?: boolean;
}> = ({ title, entries, onChange, disabled }) => {
  // Hydrate transient uids for the shared table; KeyValueRow carries
  // them so drag reorder + in-place edits stay stable across renders.
  const rowsWithUid = entries.map((e) => ({
    uid: nextOAuthParamUid(),
    key: e.key,
    value: e.value,
    description: '',
    enabled: true,
  }));

  if (disabled) {
    // Read-only mirror: render the shared table with input rows but
    // pointer-events off; the schema doesn't expose a "reserved /
    // disabled" state yet and the wrapping `disabled` flag is only
    // set by the Refresh Request reserved placeholder.
    return (
      <div style={{ opacity: 0.55, pointerEvents: 'none' }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          {title}
        </Text>
        <KeyValueTable rows={rowsWithUid} onChange={() => undefined} keyPlaceholder="Key" valuePlaceholder="Value" />
      </div>
    );
  }

  return (
    <div>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        {title}
      </Text>
      <KeyValueTable
        rows={rowsWithUid}
        onChange={(next: KeyValueRow[]) => {
          // Strip uid + the placeholder description/enabled metadata
          // before commit — the OAuth2Auth schema persists only
          // `{key, value}` entries.
          onChange(
            next
              .filter((r) => r.key.trim() || r.value.trim())
              .map(({ key, value }) => ({ key, value })),
          );
        }}
        keyPlaceholder="Key"
        valuePlaceholder="Value"
      />
    </div>
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
