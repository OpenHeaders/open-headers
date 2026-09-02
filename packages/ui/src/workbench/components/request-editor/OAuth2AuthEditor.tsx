/**
 * OAuth2AuthEditor — full OAuth 2.0 / OIDC configuration surface
 * (ARCHITECTURE §18) on the sectioned auth-form anatomy:
 *
 *   • Token — the live bundle tied to this config's `credentialRef`:
 *     the token, the Authorization header prefix, the auto-refresh
 *     fact (the executor's on-send refresh — the checkbox only
 *     surfaces it), the status with Refresh / Disconnect, and — while
 *     a device authorization is pending — the "waiting for you to
 *     approve" block: the user code (copyable), Open (the verification
 *     URL in the system browser), Cancel, the countdown. The host
 *     polls; the block follows the `oauthDeviceState` feed and the
 *     grant lands through the bundle subscription like every flow.
 *   • Grant — the form for running a fresh authorize flow: Token Name
 *     + Grant Type + Callback URL + Auth URL + Device Authorization URL
 *     (the device grant) + Access Token URL + Client ID + Client Secret
 *     + PKCE Code Challenge Method / Verifier (when the grant is PKCE)
 *     + the JWT bearer grant's own claims (issuer / subject /
 *     additional claims) + Scope + State + Client Authentication.
 *   • Signing — rendered while an assertion is in play (a JWT client
 *     authentication, or the JWT bearer grant): the algorithm, key id,
 *     private key, audience, lifetime and extra protected headers the
 *     minted assertion carries.
 *   • Advanced (folded by default) — Refresh Token URL + the Auth /
 *     Token / Refresh request extra params.
 *
 * The "Get New Access Token" action closes the form. The grant-type
 * table lives in `oauth2-grant-types.ts`; every row's (i) opens its
 * leg of the four-leg OAuth 2.0 card (AuthRowInfo).
 */

import { CopyOutlined } from '@ant-design/icons';
import { useOAuthBundlesContext } from '@openheaders/ui/context';
import { getCapability } from '@openheaders/core/capabilities';
import { ASAP_ALGORITHMS } from '@openheaders/core/auth-signing';
import {
  ASSERTION_DEFAULT_LIFETIME_SECONDS,
  ASSERTION_MAX_LIFETIME_SECONDS,
  boundDpopKeyOf,
  CLIENT_SECRET_JWT_ALGORITHMS,
  canRenewSilently,
  DPOP_DEFAULT_ALGORITHM,
  deviceVerificationUrl,
  isExpired,
  type OAuth2DeviceState,
  secondsUntilExpiry,
  usesClientAssertion,
  usesDpop,
} from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Alert, App, Button, Checkbox, Input, InputNumber, Select, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import AuthFormGroup from './AuthFormGroup';
import {
  AUTH_FIELD_DEFAULT_MAX_WIDTH as FIELD_DEFAULT_MAX_WIDTH,
  AUTH_FORM_MAX_WIDTH,
  AUTH_LABEL_WIDTH,
  AuthForm,
  AuthFormNote,
  AuthLabeledRow as LabeledRow,
  AuthSecretField as SecretField,
} from './auth-layout';
import { type AuthInfoKey, authRowInfo } from './AuthRowInfo';
import type { AuxColumn } from './editable-grid-types';
import KeyValueTable, { type KeyValueRow } from './KeyValueTable';
import { GRANT_TYPES, type GrantTypeId, getGrantType } from './oauth2-grant-types';

const { Text, Link } = Typography;

// Every control caps at the classic form width like the other types'
// fields (the URL fields are long, not wide).
const fieldStyle: React.CSSProperties = { maxWidth: FIELD_DEFAULT_MAX_WIDTH };
const jsonFieldStyle: React.CSSProperties = {
  maxWidth: FIELD_DEFAULT_MAX_WIDTH,
  fontFamily: 'monospace',
  fontSize: 12,
};

type ClientAuthentication = NonNullable<OAuth2Auth['clientAuthentication']>;

/** The signing families each assertion method offers: the asymmetric
 *  nine for a private key, the HMAC three for the client secret. */
type AlgorithmOption = { value: string; label: string };
const PRIVATE_KEY_ALGORITHM_OPTIONS: AlgorithmOption[] = ASAP_ALGORITHMS.map((a) => ({ value: a, label: a }));
const SECRET_ALGORITHM_OPTIONS: AlgorithmOption[] = CLIENT_SECRET_JWT_ALGORITHMS.map((a) => ({ value: a, label: a }));

type AssertionTextField =
  | 'assertionAlgorithm'
  | 'assertionKeyId'
  | 'assertionPrivateKey'
  | 'assertionAudience'
  | 'assertionHeaders'
  | 'assertionIssuer'
  | 'assertionSubject'
  | 'assertionClaims';

interface OAuth2AuthEditorProps {
  auth: OAuth2Auth;
  onChange: (auth: OAuth2Auth) => void;
}

const OAuth2AuthEditor: React.FC<OAuth2AuthEditorProps> = ({ auth, onChange }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = App.useApp();
  const {
    tokens,
    redirectUri,
    authorize,
    clientCredentials,
    passwordCredentials,
    jwtBearer,
    deviceStart,
    deviceCancel,
    deviceStates,
    refresh,
    revoke,
  } = useOAuthBundlesContext();
  const [busy, setBusy] = useState<null | 'authorize' | 'refresh' | 'revoke'>(null);

  const bundle = tokens[auth.credentialRef] ?? null;
  const expired = bundle ? isExpired(bundle) : false;
  // A stored token the provider issued as DPoP sends under that scheme
  // whatever the prefix says (RFC 9449 §7.1) — the row parks while bound.
  const bound = bundle !== null && boundDpopKeyOf(bundle) !== undefined;
  const dpop = usesDpop(auth);
  const setTokenBinding = (next: 'none' | 'dpop') => {
    if (next === 'dpop') {
      onChange({ ...auth, tokenBinding: 'dpop' });
      return;
    }
    const { tokenBinding: _binding, dpopAlgorithm: _algorithm, ...rest } = auth;
    onChange(rest);
  };

  // ── Device authorization (RFC 8628) ─────────────────────────────
  // The host polls; this block only follows the state feed. A terminal
  // transition toasts once (the ref remembers the state it announced)
  // and the pending block ticks its countdown every second.
  const deviceState: OAuth2DeviceState | null = deviceStates[auth.credentialRef] ?? null;
  const devicePending = deviceState?.state === 'pending' ? deviceState : null;
  const announcedRef = useRef<OAuth2DeviceState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (devicePending === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [devicePending]);
  useEffect(() => {
    if (deviceState === null || deviceState.state === 'pending' || announcedRef.current === deviceState) return;
    announcedRef.current = deviceState;
    switch (deviceState.state) {
      case 'granted':
        message.success(t('workbench.editors.request.oauth.toast.deviceGranted'));
        return;
      case 'denied':
        message.error(t('workbench.editors.request.oauth.toast.deviceDenied', { error: deviceState.message }));
        return;
      case 'expired':
        message.warning(t('workbench.editors.request.oauth.toast.deviceExpired', { error: deviceState.message }));
        return;
      case 'failed':
        message.error(t('workbench.editors.request.oauth.toast.deviceFailed', { error: deviceState.message }));
        return;
      case 'cancelled':
        return;
    }
  }, [deviceState, message, t]);
  const deviceHost = devicePending ? hostOf(devicePending.approval.verificationUri) : '';

  const grantType = useMemo(() => getGrantType(auth), [auth]);
  // The Signing group is in play for a JWT client authentication or
  // the JWT bearer grant; the secret method signs with Client Secret,
  // so its Private Key row steps aside.
  const secretJwt = auth.clientAuthentication === 'client-secret-jwt';
  const signing = usesClientAssertion(auth) || grantType.fields.assertion;
  const setAssertionField = (field: AssertionTextField) => (next: string) => {
    if (next.trim()) {
      onChange({ ...auth, [field]: next });
    } else {
      const { [field]: _omit, ...rest } = auth;
      onChange(rest);
    }
  };
  const info = (key: AuthInfoKey): InfoPopoverContent => {
    const content = authRowInfo(t, auth, key);
    // The callback's host-specific detail rides the popover body.
    if (key !== 'oauth2CallbackUrl') return content;
    return {
      ...content,
      description: (
        <span>
          {t('workbench.editors.request.oauth.callbackTipBeforeExtUrl')} <code>chrome-extension://…</code>{' '}
          {t('workbench.editors.request.oauth.callbackTipBeforeHost')} <code>chromiumapp.org</code>{' '}
          {t('workbench.editors.request.oauth.callbackTipBeforeApi')} <code>chrome.identity.launchWebAuthFlow</code>
          {t('workbench.editors.request.oauth.callbackTipAfterApi')}
        </span>
      ),
    };
  };

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
      } else if (auth.flow === 'jwt-bearer') {
        const res = await jwtBearer(auth);
        if (res.success) message.success(t('workbench.editors.request.oauth.toast.tokenReceived'));
        else message.error(t('workbench.editors.request.oauth.toast.failed', { error: res.error ?? '' }));
      } else if (auth.flow === 'device-code') {
        const res = await deviceStart(auth);
        if (res.success && res.state?.state === 'pending') {
          message.info(
            t('workbench.editors.request.oauth.toast.deviceStarted', {
              host: hostOf(res.state.approval.verificationUri),
              code: res.state.approval.userCode,
            }),
          );
        } else {
          message.error(t('workbench.editors.request.oauth.toast.failed', { error: res.error ?? '' }));
        }
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

  const handleDeviceOpen = () => {
    if (!devicePending) return;
    const url = deviceVerificationUrl(devicePending.approval);
    const openUrl = getCapability('openExternalUrl');
    if (openUrl) void openUrl(url);
    else window.open(url, '_blank', 'noopener');
  };

  const handleDeviceCancel = async () => {
    const cancelled = await deviceCancel(auth.credentialRef);
    if (cancelled) message.info(t('workbench.editors.request.oauth.toast.deviceCancelled'));
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

  const grantModified =
    auth.label !== undefined ||
    grantType.id !== 'authorization-code-pkce' ||
    auth.authorizationEndpoint !== undefined ||
    auth.deviceAuthorizationEndpoint !== undefined ||
    auth.tokenEndpoint !== '' ||
    auth.clientId !== '' ||
    auth.clientSecret !== undefined ||
    auth.username !== undefined ||
    auth.password !== undefined ||
    auth.scopes.length > 0 ||
    auth.clientAuthentication !== undefined ||
    auth.assertionIssuer !== undefined ||
    auth.assertionSubject !== undefined ||
    auth.assertionClaims !== undefined;
  const signingModified =
    auth.assertionAlgorithm !== undefined ||
    auth.assertionKeyId !== undefined ||
    auth.assertionPrivateKey !== undefined ||
    auth.assertionAudience !== undefined ||
    auth.assertionLifetimeSeconds !== undefined ||
    auth.assertionHeaders !== undefined;
  const advancedModified =
    auth.refreshEndpoint !== undefined ||
    (auth.extraAuthParams?.length ?? 0) > 0 ||
    (auth.extraTokenParams?.length ?? 0) > 0 ||
    (auth.extraRefreshParams?.length ?? 0) > 0;

  return (
    <AuthForm>
      {auth.sendAs === 'query' && (
        <Alert
          type="warning"
          showIcon
          style={{ maxWidth: AUTH_FORM_MAX_WIDTH }}
          title={t('workbench.editors.request.oauth.queryWarningTitle')}
          description={
            <>
              {t('workbench.editors.request.oauth.queryWarningBefore')} <code>Authorization: Bearer</code>{' '}
              {t('workbench.editors.request.oauth.queryWarningAfter')}
            </>
          }
        />
      )}

      <AuthFormGroup auth={auth} group="token" modified={bundle !== null}>
        <LabeledRow label={t('workbench.editors.request.oauth.tokenLabel')} info={info('oauth2Token')}>
          <Input
            size="small"
            style={fieldStyle}
            readOnly
            value={bundle ? `${bundle.accessToken.slice(0, 8)}…` : ''}
            placeholder={t('workbench.editors.request.oauth.noTokenPlaceholder')}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.oauth.headerPrefix')} info={info('oauth2HeaderPrefix')}>
          <Input
            size="small"
            value={auth.headerPrefix ?? ''}
            onChange={(e) => onChange({ ...auth, headerPrefix: e.target.value || undefined })}
            placeholder={bundle?.tokenType ?? 'Bearer'}
            disabled={bound}
            style={fieldStyle}
          />
        </LabeledRow>
        <LabeledRow label={t('workbench.editors.request.oauth.tokenBinding')} info={info('oauth2TokenBinding')}>
          <Select
            size="small"
            data-testid="oh-oauth2-token-binding"
            value={dpop ? 'dpop' : 'none'}
            onChange={setTokenBinding}
            options={[
              { value: 'none', label: t('workbench.editors.request.oauth.tokenBindingNone') },
              { value: 'dpop', label: t('workbench.editors.request.oauth.tokenBindingDpop') },
            ]}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
        {dpop && (
          <LabeledRow label={t('workbench.editors.request.oauth.dpopAlgorithm')} info={info('oauth2DpopAlgorithm')}>
            <Select
              size="small"
              data-testid="oh-oauth2-dpop-algorithm"
              value={auth.dpopAlgorithm ?? DPOP_DEFAULT_ALGORITHM}
              onChange={(next: string) => onChange({ ...auth, dpopAlgorithm: next })}
              options={PRIVATE_KEY_ALGORITHM_OPTIONS}
              style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
            />
          </LabeledRow>
        )}
        <LabeledRow
          label={t('workbench.editors.request.oauth.autoRefresh')}
          description={t('workbench.editors.request.oauth.autoRefreshDesc')}
          info={info('oauth2AutoRefresh')}
        >
          <Checkbox checked={canRenewSilently(auth, Boolean(bundle?.refreshToken))} disabled />
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
            info={info('oauth2Status')}
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
        {devicePending && (
          <LabeledRow
            label={t('workbench.editors.request.oauth.deviceCode')}
            description={t('workbench.editors.request.oauth.deviceWaitingDesc')}
            info={info('oauth2DeviceAuthUrl')}
          >
            <div
              data-testid="oh-oauth2-device-pending"
              style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
            >
              <Text strong style={{ fontSize: 12 }}>
                {t('workbench.editors.request.oauth.deviceWaitingTitle', { host: deviceHost })}
              </Text>
              <Text
                code
                data-testid="oh-oauth2-device-user-code"
                style={{ fontSize: 18, letterSpacing: 2, alignSelf: 'flex-start' }}
                copyable={{
                  text: devicePending.approval.userCode,
                  onCopy: () => message.success(t('workbench.editors.request.oauth.toast.codeCopied')),
                }}
              >
                {devicePending.approval.userCode}
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" type="primary" data-testid="oh-oauth2-device-open" onClick={handleDeviceOpen}>
                  {t('workbench.editors.request.oauth.deviceOpen')}
                </Button>
                <Button size="small" data-testid="oh-oauth2-device-cancel" onClick={() => void handleDeviceCancel()}>
                  {t('workbench.editors.request.oauth.deviceCancel')}
                </Button>
                <Text type="secondary" style={{ fontSize: 11 }} data-testid="oh-oauth2-device-countdown">
                  {`${t('workbench.editors.request.oauth.deviceExpiresIn', {
                    duration: formatDuration(Math.max(0, Math.round((devicePending.approval.expiresAt - now) / 1000))),
                  })} · ${t('workbench.editors.request.oauth.deviceCheckEvery', {
                    seconds: devicePending.approval.intervalSeconds,
                  })}`}
                </Text>
              </div>
            </div>
          </LabeledRow>
        )}
        {!bundle && !devicePending && <AuthFormNote>{t('workbench.editors.request.oauth.noTokenNote')}</AuthFormNote>}
      </AuthFormGroup>

      <AuthFormGroup auth={auth} group="grant" modified={grantModified}>
        <LabeledRow
          label={t('workbench.editors.request.oauth.tokenName')}
          description={t('workbench.editors.request.oauth.tokenNameDesc')}
          info={info('oauth2TokenName')}
        >
          <Input
            size="small"
            style={fieldStyle}
            placeholder={t('workbench.editors.request.oauth.tokenNamePlaceholder')}
            value={auth.label ?? ''}
            onChange={(e) => {
              const label = e.target.value;
              onChange({ ...auth, label: label ? label : undefined });
            }}
          />
        </LabeledRow>

        <LabeledRow label={t('workbench.editors.request.oauth.grantType')} info={info('oauth2GrantType')}>
          <Select
            size="small"
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
            value={grantType.id}
            onChange={(id: GrantTypeId) => onGrantChange(id)}
            options={GRANT_TYPES.map((g) => ({ value: g.id, label: g.label }))}
          />
        </LabeledRow>

        {grantType.fields.callbackUrl && (
          <>
            <LabeledRow label={t('workbench.editors.request.oauth.callbackUrl')} info={info('oauth2CallbackUrl')}>
              <Input
                size="small"
                style={fieldStyle}
                readOnly
                value={redirectUri ?? t('workbench.editors.request.oauth.detecting')}
                addonAfter={
                  <Tooltip title={t('shared.action.copy')}>
                    <CopyOutlined onClick={handleCopyRedirect} />
                  </Tooltip>
                }
              />
            </LabeledRow>
            {(getCapability('requestRuntime')?.() ?? 'browser') === 'node' && (
              // The node hosts' one authorize path IS the browser (RFC
              // 8252's external user agent) — the box states it, locked
              // on; its (i) carries the why and the port binding. The
              // extension's identity window is its own external agent,
              // so no checkbox renders there.
              <div
                style={{
                  marginLeft: AUTH_LABEL_WIDTH + 12,
                  marginTop: -4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Checkbox disabled checked>
                  {t('workbench.editors.request.oauth.authorizeUsingBrowser')}
                </Checkbox>
                <InfoTrigger
                  content={{
                    title: t('workbench.editors.request.oauth.authorizeUsingBrowser'),
                    summary: t('workbench.editors.request.oauth.authorizeBrowserInfoSummary'),
                    description: t('workbench.editors.request.oauth.authorizeBrowserInfoDetail'),
                  }}
                />
              </div>
            )}
          </>
        )}

        {grantType.fields.authUrl && (
          <LabeledRow label={t('workbench.editors.request.oauth.authUrl')} info={info('oauth2AuthUrl')}>
            <Input
              size="small"
              style={fieldStyle}
              placeholder="https://example.com/login/oauth/authorize"
              value={auth.authorizationEndpoint ?? ''}
              onChange={(e) => onChange({ ...auth, authorizationEndpoint: e.target.value || undefined })}
            />
          </LabeledRow>
        )}

        {grantType.fields.deviceAuthUrl && (
          <LabeledRow label={t('workbench.editors.request.oauth.deviceAuthUrl')} info={info('oauth2DeviceAuthUrl')}>
            <Input
              size="small"
              style={fieldStyle}
              data-testid="oh-oauth2-device-auth-url"
              placeholder="https://example.com/login/device/code"
              value={auth.deviceAuthorizationEndpoint ?? ''}
              onChange={(e) => onChange({ ...auth, deviceAuthorizationEndpoint: e.target.value || undefined })}
            />
          </LabeledRow>
        )}

        {grantType.fields.accessTokenUrl && (
          <LabeledRow label={t('workbench.editors.request.oauth.accessTokenUrl')} info={info('oauth2AccessTokenUrl')}>
            <Input
              size="small"
              style={fieldStyle}
              placeholder="https://example.com/login/oauth/access_token"
              value={auth.tokenEndpoint}
              onChange={(e) => onChange({ ...auth, tokenEndpoint: e.target.value })}
            />
          </LabeledRow>
        )}

        {grantType.fields.resourceOwner && (
          <>
            <LabeledRow label={t('workbench.editors.request.auth.username')} info={info('oauth2Username')}>
              <Input
                size="small"
                style={fieldStyle}
                placeholder={t('workbench.editors.request.auth.usernamePlaceholder')}
                value={auth.username ?? ''}
                onChange={(e) => onChange({ ...auth, username: e.target.value || undefined })}
              />
            </LabeledRow>
            <LabeledRow label={t('workbench.editors.request.auth.password')} info={info('oauth2Password')}>
              <Input.Password
                size="small"
                style={fieldStyle}
                placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
                value={auth.password ?? ''}
                onChange={(e) => onChange({ ...auth, password: e.target.value || undefined })}
              />
            </LabeledRow>
          </>
        )}

        {grantType.fields.clientId && (
          <LabeledRow label={t('workbench.editors.request.oauth.clientId')} info={info('oauth2ClientId')}>
            <Input
              size="small"
              style={fieldStyle}
              placeholder={t('workbench.editors.request.oauth.clientId')}
              value={auth.clientId}
              onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
            />
          </LabeledRow>
        )}

        {grantType.fields.clientSecret && (
          <LabeledRow label={t('workbench.editors.request.oauth.clientSecret')} info={info('oauth2ClientSecret')}>
            <Input.Password
              size="small"
              style={fieldStyle}
              placeholder={t('workbench.editors.request.oauth.clientSecret')}
              value={auth.clientSecret ?? ''}
              onChange={(e) => onChange({ ...auth, clientSecret: e.target.value || undefined })}
            />
          </LabeledRow>
        )}

        {grantType.fields.assertion && (
          <>
            <LabeledRow
              label={t('workbench.editors.request.oauth.assertionIssuer')}
              info={info('oauth2AssertionIssuer')}
            >
              <Input
                size="small"
                style={fieldStyle}
                data-testid="oh-oauth2-assertion-issuer"
                placeholder={t('workbench.editors.request.oauth.assertionIssuerPlaceholder')}
                value={auth.assertionIssuer ?? ''}
                onChange={(e) => setAssertionField('assertionIssuer')(e.target.value)}
              />
            </LabeledRow>
            <LabeledRow
              label={t('workbench.editors.request.oauth.assertionSubject')}
              info={info('oauth2AssertionSubject')}
            >
              <Input
                size="small"
                style={fieldStyle}
                placeholder={t('workbench.editors.request.oauth.assertionSubjectPlaceholder')}
                value={auth.assertionSubject ?? ''}
                onChange={(e) => setAssertionField('assertionSubject')(e.target.value)}
              />
            </LabeledRow>
            <LabeledRow
              label={t('workbench.editors.request.oauth.assertionClaims')}
              info={info('oauth2AssertionClaims')}
            >
              <Input.TextArea
                size="small"
                data-testid="oh-oauth2-assertion-claims"
                value={auth.assertionClaims ?? ''}
                onChange={(e) => setAssertionField('assertionClaims')(e.target.value)}
                placeholder={t('workbench.editors.request.oauth.assertionClaimsPlaceholder')}
                rows={3}
                style={jsonFieldStyle}
              />
            </LabeledRow>
          </>
        )}

        {grantType.fields.pkce && (
          <>
            <LabeledRow
              label={t('workbench.editors.request.oauth.codeChallengeMethod')}
              info={info('oauth2CodeChallengeMethod')}
            >
              <Select
                size="small"
                value="SHA-256"
                options={[{ value: 'SHA-256', label: 'SHA-256' }]}
                style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
              />
            </LabeledRow>
            <LabeledRow label={t('workbench.editors.request.oauth.codeVerifier')} info={info('oauth2CodeVerifier')}>
              <Input
                size="small"
                placeholder={t('workbench.editors.request.oauth.codeVerifierPlaceholder')}
                disabled
                style={fieldStyle}
              />
            </LabeledRow>
          </>
        )}

        {grantType.fields.scope && (
          <LabeledRow label={t('workbench.editors.request.oauth.scope')} info={info('oauth2Scope')}>
            <Select
              mode="tags"
              size="small"
              style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
              tokenSeparators={[' ', ',']}
              value={auth.scopes}
              onChange={(scopes: string[]) => onChange({ ...auth, scopes })}
              placeholder={t('workbench.editors.request.oauth.scopePlaceholder')}
            />
          </LabeledRow>
        )}

        {grantType.fields.state && (
          <LabeledRow label={t('workbench.editors.request.oauth.state')} info={info('oauth2State')}>
            <Input
              size="small"
              style={fieldStyle}
              placeholder={t('workbench.editors.request.oauth.state')}
              disabled
              value={t('workbench.editors.request.oauth.stateAuto')}
            />
          </LabeledRow>
        )}

        <LabeledRow
          label={t('workbench.editors.request.oauth.clientAuthentication')}
          description={t('workbench.editors.request.oauth.clientAuthenticationDesc')}
          info={info('oauth2ClientAuthentication')}
        >
          <Select
            size="small"
            data-testid="oh-oauth2-client-authentication"
            value={auth.clientAuthentication ?? 'body'}
            onChange={(next: ClientAuthentication) =>
              onChange({ ...auth, clientAuthentication: next === 'body' ? undefined : next })
            }
            options={[
              { value: 'body', label: t('workbench.editors.request.oauth.clientAuthBody') },
              { value: 'basic-header', label: t('workbench.editors.request.oauth.clientAuthBasicHeader') },
              { value: 'private-key-jwt', label: t('workbench.editors.request.oauth.clientAuthPrivateKeyJwt') },
              { value: 'client-secret-jwt', label: t('workbench.editors.request.oauth.clientAuthClientSecretJwt') },
            ]}
            style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
          />
        </LabeledRow>
      </AuthFormGroup>

      {signing && (
        <AuthFormGroup auth={auth} group="signing" modified={signingModified}>
          <LabeledRow
            label={t('workbench.editors.request.oauth.assertionAlgorithm')}
            info={info('oauth2AssertionAlgorithm')}
          >
            <Select
              size="small"
              data-testid="oh-oauth2-assertion-algorithm"
              value={auth.assertionAlgorithm ?? (secretJwt ? 'HS256' : 'RS256')}
              onChange={(next: string) => onChange({ ...auth, assertionAlgorithm: next })}
              options={secretJwt ? SECRET_ALGORITHM_OPTIONS : PRIVATE_KEY_ALGORITHM_OPTIONS}
              style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
            />
          </LabeledRow>
          <LabeledRow label={t('workbench.editors.request.oauth.assertionKeyId')} info={info('oauth2AssertionKeyId')}>
            <Input
              size="small"
              style={fieldStyle}
              placeholder={t('workbench.editors.request.oauth.assertionKeyIdPlaceholder')}
              value={auth.assertionKeyId ?? ''}
              onChange={(e) => setAssertionField('assertionKeyId')(e.target.value)}
            />
          </LabeledRow>
          {!secretJwt && (
            <LabeledRow
              label={t('workbench.editors.request.oauth.assertionPrivateKey')}
              info={info('oauth2AssertionPrivateKey')}
            >
              <SecretField
                value={auth.assertionPrivateKey ?? ''}
                onChange={setAssertionField('assertionPrivateKey')}
                placeholder={t('workbench.editors.request.oauth.assertionPrivateKeyPlaceholder')}
                data-testid="oh-oauth2-assertion-private-key"
              />
            </LabeledRow>
          )}
          <LabeledRow
            label={t('workbench.editors.request.oauth.assertionAudience')}
            info={info('oauth2AssertionAudience')}
          >
            <Input
              size="small"
              style={fieldStyle}
              placeholder={auth.tokenEndpoint || t('workbench.editors.request.oauth.assertionAudiencePlaceholder')}
              value={auth.assertionAudience ?? ''}
              onChange={(e) => setAssertionField('assertionAudience')(e.target.value)}
            />
          </LabeledRow>
          <LabeledRow
            label={t('workbench.editors.request.oauth.assertionLifetime')}
            info={info('oauth2AssertionLifetime')}
          >
            <InputNumber
              size="small"
              data-testid="oh-oauth2-assertion-lifetime"
              min={1}
              max={ASSERTION_MAX_LIFETIME_SECONDS}
              value={auth.assertionLifetimeSeconds}
              onChange={(next) => {
                if (typeof next === 'number') {
                  onChange({ ...auth, assertionLifetimeSeconds: next });
                } else {
                  const { assertionLifetimeSeconds: _omit, ...rest } = auth;
                  onChange(rest);
                }
              }}
              placeholder={String(ASSERTION_DEFAULT_LIFETIME_SECONDS)}
              style={{ width: '100%', maxWidth: FIELD_DEFAULT_MAX_WIDTH }}
            />
          </LabeledRow>
          <LabeledRow
            label={t('workbench.editors.request.oauth.assertionHeaders')}
            info={info('oauth2AssertionHeaders')}
          >
            <Input.TextArea
              size="small"
              data-testid="oh-oauth2-assertion-headers"
              value={auth.assertionHeaders ?? ''}
              onChange={(e) => setAssertionField('assertionHeaders')(e.target.value)}
              placeholder={t('workbench.editors.request.oauth.assertionHeadersPlaceholder')}
              rows={2}
              style={jsonFieldStyle}
            />
          </LabeledRow>
        </AuthFormGroup>
      )}

      <AuthFormGroup auth={auth} group="advanced" modified={advancedModified} defaultCollapsed>
        <AuthFormNote>
          {t('workbench.editors.request.oauth.advancedIntro')}{' '}
          <Link>{t('workbench.editors.request.oauth.advancedLearnMore')}</Link>.
        </AuthFormNote>
        <LabeledRow
          label={t('workbench.editors.request.oauth.refreshTokenUrl')}
          description={t('workbench.editors.request.oauth.refreshTokenUrlDesc')}
          info={info('oauth2RefreshTokenUrl')}
        >
          <Input
            size="small"
            style={fieldStyle}
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
          info={info('oauth2AuthRequest')}
          entries={auth.extraAuthParams ?? []}
          onChange={(entries) => onChange({ ...auth, extraAuthParams: entries.length === 0 ? undefined : entries })}
        />
        <ParamsBlock
          title={t('workbench.editors.request.oauth.tokenRequest')}
          info={info('oauth2TokenRequest')}
          sendInEditable
          entries={auth.extraTokenParams ?? []}
          onChange={(entries) => onChange({ ...auth, extraTokenParams: entries.length === 0 ? undefined : entries })}
        />
        <ParamsBlock
          title={t('workbench.editors.request.oauth.refreshRequest')}
          info={info('oauth2RefreshRequest')}
          sendInEditable
          entries={auth.extraRefreshParams ?? []}
          onChange={(entries) =>
            onChange({ ...auth, extraRefreshParams: entries.length === 0 ? undefined : entries })
          }
        />
      </AuthFormGroup>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Button
          type="primary"
          size="middle"
          onClick={() => void handleGetNewToken()}
          loading={busy === 'authorize'}
          disabled={devicePending !== null}
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

      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.request.oauth.storedFootnoteBefore')} <code>{auth.credentialRef}</code>
        {t('workbench.editors.request.oauth.storedFootnoteAfter')}
      </Text>
    </AuthForm>
  );
};

// ── Pieces ────────────────────────────────────────────────────────

interface ParamEntry {
  uid: string;
  key: string;
  value: string;
  /** Token/refresh tables only — where the row rides the POST
   *  (absent = the form body). */
  sendIn?: 'body' | 'header' | 'url';
}

/**
 * ParamsBlock — wraps the shared `KeyValueTable` so OAuth2's extra
 * Auth / Token / Refresh parameter lists carry the same chrome as
 * every other key-value surface in the extension (drag, checkbox,
 * Bulk Edit, column-hide menu). The OAuth2 storage shape is
 * deliberately narrow (`{key, value}` entries — no description /
 * enabled on the schema), so the adapter maps onto KeyValueRow and
 * strips the extra fields on commit. The token/refresh tables opt
 * into a per-row Send In track (`sendInEditable`) routing each param
 * onto the POST body (the default), an HTTP header, or the endpoint
 * URL — auth-request params are URL-appended by definition, so the
 * auth table stays two-column. The title carries the block's (i);
 * the table stops at the form's right edge like the fields above it.
 */
const ParamsBlock: React.FC<{
  title: string;
  info: InfoPopoverContent;
  entries: ParamEntry[];
  onChange: (entries: ParamEntry[]) => void;
  sendInEditable?: boolean;
}> = ({ title, info, entries, onChange, sendInEditable = false }) => {
  const t = useT();
  // Hydrate transient uids for the shared table; KeyValueRow carries
  // them so drag reorder + in-place edits stay stable across renders.
  const rowsWithUid: KeyValueRow[] = entries.map((e) => ({
    uid: e.uid,
    key: e.key,
    value: e.value,
    description: '',
    enabled: true,
  }));
  // `sendIn` lives beside the table's row shape — merged back by uid on
  // every commit so key/value edits never shed it.
  const sendInByUid = new Map(entries.map((e) => [e.uid, e.sendIn]));
  const withSendIn = (r: KeyValueRow): ParamEntry => {
    const sendIn = sendInByUid.get(r.uid);
    return { uid: r.uid || generateUid(), key: r.key, value: r.value, ...(sendIn ? { sendIn } : {}) };
  };
  const setSendIn = (uid: string, next: 'body' | 'header' | 'url') => {
    onChange(
      entries.map((e) => {
        if (e.uid !== uid) return e;
        const { sendIn: _omit, ...rest } = e;
        return next === 'body' ? rest : { ...rest, sendIn: next };
      }),
    );
  };
  const auxColumns: AuxColumn<KeyValueRow>[] | undefined = sendInEditable
    ? [
        {
          label: t('workbench.editors.request.oauth.sendInColumn'),
          width: '96px',
          position: 'after-value',
          divider: true,
          render: (row, _update, ctx) =>
            ctx.isPlaceholder ? null : (
              <Select
                size="small"
                variant="borderless"
                data-testid="oh-oauth2-param-send-in"
                value={sendInByUid.get(row.uid) ?? 'body'}
                onChange={(next: 'body' | 'header' | 'url') => setSendIn(row.uid, next)}
                options={[
                  { value: 'body', label: t('workbench.editors.request.oauth.sendInBody') },
                  { value: 'header', label: t('workbench.editors.request.oauth.sendInHeader') },
                  { value: 'url', label: t('workbench.editors.request.oauth.sendInUrl') },
                ]}
                style={{ width: '100%', fontSize: 12 }}
              />
            ),
        },
      ]
    : undefined;

  return (
    <div style={{ maxWidth: AUTH_FORM_MAX_WIDTH }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 12 }}>
          {title}
        </Text>
        <InfoTrigger content={info} />
      </div>
      <KeyValueTable
        rows={rowsWithUid}
        onChange={(next: KeyValueRow[]) => {
          onChange(next.filter((r) => r.key.trim() || r.value.trim()).map(withSendIn));
        }}
        auxColumns={auxColumns}
      />
    </div>
  );
};

/** The host the user approves on — the verification URI's host, or the
 *  URI itself when it does not parse. */
function hostOf(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 0) return 'expired';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86_400)}d`;
}

export default OAuth2AuthEditor;
