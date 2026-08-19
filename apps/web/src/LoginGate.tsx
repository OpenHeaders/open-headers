/**
 * Minimal pairing gate rendered INSTEAD of the Workbench when the
 * serving daemon is reachable but this tab holds no paired token yet.
 * A submitted token rides a real HELLO; only a WELCOME accept persists
 * it and mounts the Workbench.
 *
 * "Work locally" keeps the tab offline-first without pairing — the
 * escape hatch for a personal/dev daemon you don't have to sign in to.
 * It is suppressed once the daemon carries a managed login (OIDC or
 * local password): an admin declaring "you authenticate to use this"
 * is contradicted by a one-click local bypass, and on a dedicated
 * deployment the affordance only reads as a confusing "skip login".
 * Suppressing it never traps anyone — the gate appears only while the
 * daemon is reachable (`decideGate`); an unreachable managed daemon
 * mounts the local workbench with no gate at all.
 */

import { useT } from '@openheaders/ui/context';
import { Alert, Button, Divider, Input, Typography } from 'antd';
import { useState } from 'react';
import type { DaemonWire } from '@/host/daemon-wire';
import { submitDaemonToken } from '@/host/join-gate';
import { isSeatRefusalReason, oidcErrorKey, startOidcLogin } from '@/host/oidc-login';
import { submitPasswordLogin } from '@/host/password-login';
import { showTransitionOverlay } from '@/transition-overlay';

const CARD_STYLE: React.CSSProperties = {
  maxWidth: 400,
  margin: '18vh auto 0',
  padding: '32px 36px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

export interface LoginGateProps {
  wire: DaemonWire;
  /** Called once the daemon accepted the token (already persisted). */
  onJoined: () => void;
  /** Called when the user chooses to keep working locally. */
  onSkip: () => void;
  /** SSO provider label when the daemon has OIDC configured; null/absent = token-only gate. */
  ssoProvider?: string | null;
  /** The daemon offers local password login (no OIDC, at least one user holds a password). */
  passwordEnabled?: boolean;
  /** Refusal reason of a failed SSO round-trip carried into the gate — keyed to its message here. */
  initialErrorReason?: string | null;
}

export function LoginGate({
  wire,
  onJoined,
  onSkip,
  ssoProvider,
  passwordEnabled,
  initialErrorReason,
}: LoginGateProps): React.JSX.Element {
  const t = useT();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalKey, setPersonalKey] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    initialErrorReason != null ? t(oidcErrorKey(initialErrorReason)) : null,
  );
  // The seat wall is the conversion moment: offer the self-serve way in.
  const seatBlocked = Boolean(ssoProvider) && isSeatRefusalReason(initialErrorReason);

  const submit = async (): Promise<void> => {
    if (pending || token.trim().length === 0) return;
    setPending(true);
    setError(null);
    const result = await submitDaemonToken(wire, token);
    setPending(false);
    if (result.ok) {
      // Mask the gate→workbench gap (join → adopt → workspace promote)
      // so the accepted login doesn't sit on a frozen gate.
      showTransitionOverlay(t('web.overlay.signingIn'));
      onJoined();
      return;
    }
    setError(t(result.reason === 'rejected' ? 'web.gate.errorTokenRejected' : 'web.gate.errorTokenOffline'));
  };

  const canSubmitPassword = email.trim().length > 0 && password.length > 0;
  // A managed login (SSO or local password) means an admin controls who
  // gets in — the local-only escape hatch contradicts that, so hide it.
  const managedLogin = Boolean(ssoProvider) || Boolean(passwordEnabled);

  const submitPassword = async (): Promise<void> => {
    if (pending || !canSubmitPassword) return;
    setPending(true);
    setError(null);
    // The secret rides the exact pasted-token path: real HELLO,
    // persisted only on WELCOME accept.
    const secret = await submitPasswordLogin(email, password);
    const result = secret ? await submitDaemonToken(wire, secret) : null;
    setPending(false);
    if (result?.ok) {
      showTransitionOverlay(t('web.overlay.signingIn'));
      onJoined();
      return;
    }
    setError(t(secret === null ? 'web.gate.errorPasswordRefused' : 'web.gate.errorSessionRefused'));
  };

  return (
    <div style={CARD_STYLE} data-testid="login-gate">
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t(managedLogin ? 'web.gate.titleSignIn' : 'web.gate.titlePair')}
      </Typography.Title>
      <Typography.Paragraph style={{ margin: 0 }} type="secondary">
        {ssoProvider ? (
          t('web.gate.introSso', { provider: ssoProvider })
        ) : passwordEnabled ? (
          t('web.gate.introPassword')
        ) : (
          <>
            {t('web.gate.introTokenPrefix')} <Typography.Text code>ohd show-token</Typography.Text>{' '}
            {t('web.gate.introTokenSuffix')}
          </>
        )}
      </Typography.Paragraph>
      {ssoProvider && (
        <>
          <Button
            type="primary"
            block
            onClick={() => {
              // Full-page redirect to the IdP — cover the beat before the
              // browser navigates so the click isn't a dead press.
              showTransitionOverlay(t('web.overlay.takingYouTo', { provider: ssoProvider }));
              startOidcLogin();
            }}
            disabled={pending}
            data-testid="login-gate-sso"
          >
            {t('web.gate.ssoButton', { provider: ssoProvider })}
          </Button>
          <Divider plain style={{ margin: 0 }}>
            {t('web.gate.or')}
          </Divider>
        </>
      )}
      {passwordEnabled && (
        <>
          <Input
            autoFocus
            type="email"
            data-testid="login-gate-email"
            placeholder={t('web.gate.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
          <Input.Password
            data-testid="login-gate-password"
            placeholder={t('web.gate.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={() => void submitPassword()}
            disabled={pending}
          />
          <Button
            type="primary"
            block
            loading={pending}
            disabled={!canSubmitPassword}
            onClick={() => void submitPassword()}
            data-testid="login-gate-password-submit"
          >
            {t('web.gate.signIn')}
          </Button>
          <Divider plain style={{ margin: 0 }}>
            {t('web.gate.or')}
          </Divider>
        </>
      )}
      <Input.Password
        autoFocus={!managedLogin}
        data-testid="login-gate-token"
        placeholder={t('web.gate.tokenPlaceholder')}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onPressEnter={() => void submit()}
        disabled={pending}
      />
      {error && <Alert type="error" showIcon message={error} data-testid="login-gate-error" />}
      {seatBlocked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="login-gate-personal-seat">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('web.gate.seatIntroPrefix')}{' '}
            <Typography.Link href="https://openheaders.com/pricing" target="_blank">
              openheaders.com/pricing
            </Typography.Link>
            {t('web.gate.seatIntroSuffix')}
          </Typography.Text>
          <Input.Password
            placeholder={t('web.gate.seatKeyPlaceholder')}
            value={personalKey}
            onChange={(e) => setPersonalKey(e.target.value)}
            disabled={pending}
            data-testid="login-gate-personal-key"
          />
          <Button
            block
            disabled={pending || personalKey.trim().length === 0}
            onClick={() => {
              showTransitionOverlay(t('web.overlay.takingYouTo', { provider: ssoProvider ?? '' }));
              startOidcLogin(undefined, { personalLicense: personalKey });
            }}
            data-testid="login-gate-personal-submit"
          >
            {t('web.gate.seatSignIn')}
          </Button>
        </div>
      )}
      <Button
        type={managedLogin ? 'default' : 'primary'}
        block
        loading={pending}
        disabled={token.trim().length === 0}
        onClick={() => void submit()}
        data-testid="login-gate-submit"
      >
        {t('web.gate.connect')}
      </Button>
      {!managedLogin && (
        <Button type="link" block onClick={onSkip} disabled={pending} data-testid="login-gate-skip">
          {t('web.gate.workLocally')}
        </Button>
      )}
    </div>
  );
}
