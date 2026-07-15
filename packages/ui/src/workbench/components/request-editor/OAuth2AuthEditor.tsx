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
 * The grant-type dropdown offers the flows that actually run
 * end-to-end on a browser extension:
 *   • "Authorization Code (With PKCE)" → authorization-code-pkce (browser flow)
 *   • "Authorization Code"             → same wire flow with the PKCE
 *     pair omitted (plain RFC 6749 §4.1 providers; secret expected)
 *   • "Client Credentials"             → client-credentials (machine-to-machine)
 *   • "Password Credentials"           → password-credentials (RFC 6749
 *     §4.3 resource-owner password; legacy IdPs only)
 *
 * Deprecated / ill-fitting flows are intentionally not offered:
 * Implicit is removed by OAuth 2.1 (PKCE supersedes it for public
 * clients) and Device Code earns its keep only where there is no
 * browser. They can return when a real integration needs one.
 */

import { CopyOutlined, DownOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import { useOAuthBundlesContext } from '@openheaders/ui/context';
import { isExpired, secondsUntilExpiry } from '@openheaders/core/oauth';
import type { OAuth2Auth, OAuth2Flow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Alert, App, Button, Checkbox, Input, Select, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import KeyValueTable, { type KeyValueRow } from './KeyValueTable';

const { Text, Link } = Typography;

// ── Grant type UI model ───────────────────────────────────────────

type GrantTypeId = 'authorization-code-pkce' | 'authorization-code' | 'client-credentials' | 'password-credentials';

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
    resourceOwner: boolean;
    pkce: boolean;
    scope: boolean;
    state: boolean;
  };
  /** Maps back to the persisted flow. */
  v5Flow: OAuth2Flow;
}

const GRANT_TYPES: GrantTypeDef[] = [
  {
    id: 'authorization-code-pkce',
    label: 'Authorization Code (With PKCE)',
    fields: {
      callbackUrl: true,
      authUrl: true,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: true,
      scope: true,
      state: true,
    },
    v5Flow: 'authorization-code-pkce',
  },
  {
    id: 'authorization-code',
    label: 'Authorization Code',
    fields: {
      callbackUrl: true,
      authUrl: true,
      accessTokenUrl: true,
      clientId: true,
      clientSecret: true,
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: true,
    },
    // Same wire flow — the persisted grantType suppresses the PKCE
    // pair on both legs (see `usesPkce` in core/oauth).
    v5Flow: 'authorization-code-pkce',
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
      resourceOwner: false,
      pkce: false,
      scope: true,
      state: false,
    },
    v5Flow: 'client-credentials',
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
      resourceOwner: true,
      pkce: false,
      scope: true,
      state: false,
    },
    v5Flow: 'password-credentials',
  },
];

function getGrantType(auth: OAuth2Auth): GrantTypeDef {
  // Prefer the persisted UI choice. Rows that stored a grant type we
  // don't offer (`implicit` / `device-code`) fall through to the
  // working flow their wire `flow` already maps to.
  if (auth.grantType) {
    const match = GRANT_TYPES.find((g) => g.id === auth.grantType);
    if (match) return match;
  }
  const byFlow = GRANT_TYPES.find((g) => g.v5Flow === auth.flow);
  return byFlow ?? GRANT_TYPES[0];
}

// ── Component ─────────────────────────────────────────────────────

interface OAuth2AuthEditorProps {
  auth: OAuth2Auth;
  onChange: (auth: OAuth2Auth) => void;
}

const OAuth2AuthEditor: React.FC<OAuth2AuthEditorProps> = ({ auth, onChange }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = App.useApp();
  const { tokens, redirectUri, authorize, clientCredentials, passwordCredentials, refresh, revoke } =
    useOAuthBundlesContext();
  const [busy, setBusy] = useState<null | 'authorize' | 'refresh' | 'revoke'>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
        if (res.success) message.success(t('workbench.editors.request.oauth.toast.tokenReceived'));
        else message.error(t('workbench.editors.request.oauth.toast.failed', { error: res.error ?? '' }));
      } else if (auth.flow === 'password-credentials') {
        const res = await passwordCredentials(auth);
        if (res.success) message.success(t('workbench.editors.request.oauth.toast.tokenReceived'));
        else message.error(t('workbench.editors.request.oauth.toast.failed', { error: res.error ?? '' }));
      } else {
        const res = await authorize(auth);
        if (res.success) message.success(t('workbench.editors.request.oauth.toast.authorizationComplete'));
        else message.error(t('workbench.editors.request.oauth.toast.failed', { error: res.error ?? '' }));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy('refresh');
    try {
      const res = await refresh(auth);
      if (res.success) message.success(t('workbench.editors.request.oauth.toast.refreshed'));
      else message.error(t('workbench.editors.request.oauth.toast.refreshFailed', { error: res.error ?? '' }));
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async () => {
    setBusy('revoke');
    try {
      const removed = await revoke(auth.credentialRef);
      if (removed) message.success(t('workbench.editors.request.oauth.toast.disconnected'));
    } finally {
      setBusy(null);
    }
  };

  const handleCopyRedirect = async () => {
    if (!redirectUri) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
      message.success(t('workbench.editors.request.oauth.toast.callbackCopied'));
    } catch {
      message.warning(t('workbench.editors.request.oauth.toast.copyUnsupported'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {auth.sendAs === 'query' && (
        <Alert
          type="warning"
          showIcon
          message={t('workbench.editors.request.oauth.queryWarningTitle')}
          description={
            <>
              {t('workbench.editors.request.oauth.queryWarningBefore')} <code>Authorization: Bearer</code>{' '}
              {t('workbench.editors.request.oauth.queryWarningAfter')}
            </>
          }
        />
      )}

      {/* ── Current Token ────────────────────────────────────────────── */}
      <div>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
          {t('workbench.editors.request.oauth.currentToken')}
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LabeledRow label={t('workbench.editors.request.oauth.tokenLabel')}>
            <Input
              size="small"
              readOnly
              value={bundle ? `${bundle.accessToken.slice(0, 8)}…` : ''}
              placeholder={t('workbench.editors.request.oauth.noTokenPlaceholder')}
            />
          </LabeledRow>
          <LabeledRow label={t('workbench.editors.request.oauth.headerPrefix')}>
            <Input size="small" readOnly value={bundle?.tokenType ?? 'Bearer'} />
          </LabeledRow>
          <LabeledRow
            label={t('workbench.editors.request.oauth.autoRefresh')}
            description={t('workbench.editors.request.oauth.autoRefreshDesc')}
          >
            <Checkbox
              checked={Boolean(bundle?.refreshToken)}
              disabled
              style={{ marginLeft: 'auto', display: 'block' }}
            />
          </LabeledRow>
          {bundle && (
            <LabeledRow
              label={t('workbench.editors.request.oauth.status')}
              description={
                expired
                  ? t('workbench.editors.request.oauth.statusExpired')
                  : t('workbench.editors.request.oauth.statusValid', {
                      duration: formatDuration(secondsUntilExpiry(bundle) ?? 0),
                    })
              }
            >
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {bundle.refreshToken && (
                  <Button size="small" onClick={() => void handleRefresh()} disabled={busy !== null}>
                    {t('workbench.editors.request.oauth.refreshNow')}
                  </Button>
                )}
                <Button size="small" danger onClick={() => void handleRevoke()} disabled={busy !== null}>
                  {t('workbench.editors.request.oauth.disconnect')}
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
          {t('workbench.editors.request.oauth.configureNewToken')}
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LabeledRow
            label={t('workbench.editors.request.oauth.tokenName')}
            description={t('workbench.editors.request.oauth.tokenNameDesc')}
          >
            <Input
              size="small"
              placeholder={t('workbench.editors.request.oauth.tokenNamePlaceholder')}
              value={auth.label ?? ''}
              onChange={(e) => {
                const label = e.target.value;
                onChange({ ...auth, label: label ? label : undefined });
              }}
            />
          </LabeledRow>

          <LabeledRow label={t('workbench.editors.request.oauth.grantType')}>
            <Select
              size="small"
              style={{ width: '100%' }}
              value={grantType.id}
              onChange={(id: GrantTypeId) => onGrantChange(id)}
              options={GRANT_TYPES.map((g) => ({ value: g.id, label: g.label }))}
            />
          </LabeledRow>

          {grantType.fields.callbackUrl && (
            <>
              <LabeledRow label={t('workbench.editors.request.oauth.callbackUrl')}>
                <Input
                  size="small"
                  readOnly
                  value={redirectUri ?? t('workbench.editors.request.oauth.detecting')}
                  suffix={
                    <Tooltip
                      title={
                        <span>
                          {t('workbench.editors.request.oauth.callbackTipBeforeExtUrl')}{' '}
                          <code>chrome-extension://…</code>{' '}
                          {t('workbench.editors.request.oauth.callbackTipBeforeHost')} <code>chromiumapp.org</code>{' '}
                          {t('workbench.editors.request.oauth.callbackTipBeforeApi')}{' '}
                          <code>chrome.identity.launchWebAuthFlow</code>
                          {t('workbench.editors.request.oauth.callbackTipAfterApi')}
                        </span>
                      }
                      overlayStyle={{ maxWidth: 380 }}
                    >
                      <InfoCircleOutlined style={{ color: 'rgba(0, 0, 0, 0.45)', cursor: 'help' }} />
                    </Tooltip>
                  }
                  addonAfter={
                    <Tooltip title={t('shared.action.copy')}>
                      <CopyOutlined onClick={handleCopyRedirect} />
                    </Tooltip>
                  }
                />
              </LabeledRow>
              <div style={{ marginLeft: 152, marginTop: -4 }}>
                <Checkbox disabled checked={false}>
                  {t('workbench.editors.request.oauth.authorizeUsingBrowser')}
                </Checkbox>
              </div>
            </>
          )}

          {grantType.fields.authUrl && (
            <LabeledRow label={t('workbench.editors.request.oauth.authUrl')}>
              <Input
                size="small"
                placeholder="https://example.com/login/oauth/authorize"
                value={auth.authorizationEndpoint ?? ''}
                onChange={(e) => onChange({ ...auth, authorizationEndpoint: e.target.value || undefined })}
              />
            </LabeledRow>
          )}

          {grantType.fields.accessTokenUrl && (
            <LabeledRow label={t('workbench.editors.request.oauth.accessTokenUrl')}>
              <Input
                size="small"
                placeholder="https://example.com/login/oauth/access_token"
                value={auth.tokenEndpoint}
                onChange={(e) => onChange({ ...auth, tokenEndpoint: e.target.value })}
              />
            </LabeledRow>
          )}

          {grantType.fields.resourceOwner && (
            <>
              <LabeledRow label={t('workbench.editors.request.auth.username')}>
                <Input
                  size="small"
                  placeholder={t('workbench.editors.request.auth.usernamePlaceholder')}
                  value={auth.username ?? ''}
                  onChange={(e) => onChange({ ...auth, username: e.target.value || undefined })}
                />
              </LabeledRow>
              <LabeledRow label={t('workbench.editors.request.auth.password')}>
                <Input.Password
                  size="small"
                  placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
                  value={auth.password ?? ''}
                  onChange={(e) => onChange({ ...auth, password: e.target.value || undefined })}
                />
              </LabeledRow>
            </>
          )}

          {grantType.fields.clientId && (
            <LabeledRow label={t('workbench.editors.request.oauth.clientId')}>
              <Input
                size="small"
                placeholder={t('workbench.editors.request.oauth.clientId')}
                value={auth.clientId}
                onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
              />
            </LabeledRow>
          )}

          {grantType.fields.clientSecret && (
            <LabeledRow label={t('workbench.editors.request.oauth.clientSecret')}>
              <Input.Password
                size="small"
                placeholder={t('workbench.editors.request.oauth.clientSecret')}
                value={auth.clientSecret ?? ''}
                onChange={(e) => onChange({ ...auth, clientSecret: e.target.value || undefined })}
              />
            </LabeledRow>
          )}

          {grantType.fields.pkce && (
            <>
              <LabeledRow label={t('workbench.editors.request.oauth.codeChallengeMethod')}>
                <Select
                  size="small"
                  value="SHA-256"
                  options={[{ value: 'SHA-256', label: 'SHA-256' }]}
                  style={{ width: '100%' }}
                />
              </LabeledRow>
              <LabeledRow label={t('workbench.editors.request.oauth.codeVerifier')}>
                <Input size="small" placeholder={t('workbench.editors.request.oauth.codeVerifierPlaceholder')} disabled />
              </LabeledRow>
            </>
          )}

          {grantType.fields.scope && (
            <LabeledRow label={t('workbench.editors.request.oauth.scope')}>
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
            <LabeledRow label={t('workbench.editors.request.oauth.state')}>
              <Input
                size="small"
                placeholder={t('workbench.editors.request.oauth.state')}
                disabled
                value={t('workbench.editors.request.oauth.stateAuto')}
              />
            </LabeledRow>
          )}

          <LabeledRow
            label={t('workbench.editors.request.oauth.clientAuthentication')}
            description={t('workbench.editors.request.oauth.clientAuthenticationDesc')}
          >
            <Select
              size="small"
              value={auth.clientAuthentication ?? 'body'}
              onChange={(next: 'body' | 'basic-header') =>
                onChange({ ...auth, clientAuthentication: next === 'body' ? undefined : next })
              }
              options={[
                { value: 'body', label: t('workbench.editors.request.oauth.clientAuthBody') },
                { value: 'basic-header', label: t('workbench.editors.request.oauth.clientAuthBasicHeader') },
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
              {advancedOpen ? <DownOutlined /> : <RightOutlined />} {t('workbench.editors.request.oauth.advanced')}
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
                  {t('workbench.editors.request.oauth.advancedIntro')}{' '}
                  <Link>{t('workbench.editors.request.oauth.advancedLearnMore')}</Link>.
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                  <LabeledRow
                    label={t('workbench.editors.request.oauth.refreshTokenUrl')}
                    description={t('workbench.editors.request.oauth.refreshTokenUrlDesc')}
                  >
                    <Input
                      size="small"
                      placeholder={auth.tokenEndpoint || 'https://example.com/login/oauth/refresh_token'}
                      value={auth.refreshEndpoint ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        onChange({ ...auth, refreshEndpoint: next ? next : undefined });
                      }}
                    />
                  </LabeledRow>
                  <ParamsBlock
                    title={t('workbench.editors.request.oauth.authRequest')}
                    entries={auth.extraAuthParams ?? []}
                    onChange={(entries) =>
                      onChange({ ...auth, extraAuthParams: entries.length === 0 ? undefined : entries })
                    }
                  />
                  <ParamsBlock
                    title={t('workbench.editors.request.oauth.tokenRequest')}
                    entries={auth.extraTokenParams ?? []}
                    onChange={(entries) =>
                      onChange({ ...auth, extraTokenParams: entries.length === 0 ? undefined : entries })
                    }
                  />
                  <ParamsBlock
                    title={t('workbench.editors.request.oauth.refreshRequest')}
                    entries={auth.extraRefreshParams ?? []}
                    onChange={(entries) =>
                      onChange({ ...auth, extraRefreshParams: entries.length === 0 ? undefined : entries })
                    }
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
              {t('workbench.editors.request.oauth.getNewToken')}
            </Button>
            {bundle && (
              <Button size="middle" onClick={() => void handleRevoke()} disabled={busy !== null}>
                {t('workbench.editors.request.oauth.clearCookies')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
        {t('workbench.editors.request.oauth.storedFootnoteBefore')} <code>{auth.credentialRef}</code>
        {t('workbench.editors.request.oauth.storedFootnoteAfter')}
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
  uid: string;
  key: string;
  value: string;
}

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
}> = ({ title, entries, onChange }) => {
  // Hydrate transient uids for the shared table; KeyValueRow carries
  // them so drag reorder + in-place edits stay stable across renders.
  const rowsWithUid: KeyValueRow[] = entries.map((e) => ({
    uid: e.uid,
    key: e.key,
    value: e.value,
    description: '',
    enabled: true,
  }));

  return (
    <div>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        {title}
      </Text>
      <KeyValueTable
        rows={rowsWithUid}
        onChange={(next: KeyValueRow[]) => {
          onChange(
            next
              .filter((r) => r.key.trim() || r.value.trim())
              .map((r) => ({ uid: r.uid || generateUid(), key: r.key, value: r.value })),
          );
        }}
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
