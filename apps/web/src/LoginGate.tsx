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

import { Alert, Button, Divider, Input, Typography } from 'antd';
import { useState } from 'react';
import type { DaemonWire } from '@/host/daemon-wire';
import { submitDaemonToken } from '@/host/join-gate';
import { isSeatRefusalReason, startOidcLogin } from '@/host/oidc-login';
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
  /** Error carried into the gate (e.g. a failed SSO round-trip). */
  initialError?: string | null;
  /** Raw refusal reason behind `initialError` — drives the personal-seat redeem affordance. */
  initialErrorReason?: string | null;
}

export function LoginGate({
  wire,
  onJoined,
  onSkip,
  ssoProvider,
  passwordEnabled,
  initialError,
  initialErrorReason,
}: LoginGateProps): React.JSX.Element {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalKey, setPersonalKey] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  // The seat wall is the conversion moment: offer the self-serve way in.
  const seatBlocked = Boolean(ssoProvider) && isSeatRefusalReason(initialErrorReason);

  const submit = async (): Promise<void> => {
    if (pending || token.trim().length === 0) return;
    setPending(true);
    setError(null);
    const result = await submitDaemonToken(wire, token);
    setPending(false);
    if (result.ok) {
      onJoined();
      return;
    }
    setError(
      result.reason === 'rejected'
        ? 'The daemon rejected this token. Check it and try again.'
        : 'The daemon did not answer. Check that it is running and try again.',
    );
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
      onJoined();
      return;
    }
    setError(
      secret === null
        ? 'Sign-in failed. Check the email and password and try again.'
        : 'The daemon did not accept the session. Try again.',
    );
  };

  return (
    <div style={CARD_STYLE} data-testid="login-gate">
      <Typography.Title level={4} style={{ margin: 0 }}>
        {managedLogin ? 'Sign in to this daemon' : 'Pair with this daemon'}
      </Typography.Title>
      <Typography.Paragraph style={{ margin: 0 }} type="secondary">
        {ssoProvider ? (
          <>Sign in with {ssoProvider}, or paste a pairing token below.</>
        ) : passwordEnabled ? (
          'Sign in with the email and password the daemon admin set for you, or paste a pairing token below.'
        ) : (
          <>
            This OpenHeaders daemon requires a pairing token. Mint one on the machine running it with{' '}
            <Typography.Text code>ohd show-token</Typography.Text> and paste it below.
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
              showTransitionOverlay(`Taking you to ${ssoProvider}…`);
              startOidcLogin();
            }}
            disabled={pending}
            data-testid="login-gate-sso"
          >
            Sign in with {ssoProvider}
          </Button>
          <Divider plain style={{ margin: 0 }}>
            or
          </Divider>
        </>
      )}
      {passwordEnabled && (
        <>
          <Input
            autoFocus
            type="email"
            data-testid="login-gate-email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
          <Input.Password
            data-testid="login-gate-password"
            placeholder="Password"
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
            Sign in
          </Button>
          <Divider plain style={{ margin: 0 }}>
            or
          </Divider>
        </>
      )}
      <Input.Password
        autoFocus={!managedLogin}
        data-testid="login-gate-token"
        placeholder="Pairing token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onPressEnter={() => void submit()}
        disabled={pending}
      />
      {error && <Alert type="error" showIcon message={error} data-testid="login-gate-error" />}
      {seatBlocked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="login-gate-personal-seat">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Have an individual seat? Paste its key to sign in without waiting on a free team seat — it admits the email it
            was purchased with. Get one at{' '}
            <Typography.Link href="https://openheaders.io/pricing" target="_blank">
              openheaders.io/pricing
            </Typography.Link>
            .
          </Typography.Text>
          <Input.Password
            placeholder="Individual seat key (oh-license.…)"
            value={personalKey}
            onChange={(e) => setPersonalKey(e.target.value)}
            disabled={pending}
            data-testid="login-gate-personal-key"
          />
          <Button
            block
            disabled={pending || personalKey.trim().length === 0}
            onClick={() => {
              showTransitionOverlay(`Taking you to ${ssoProvider}…`);
              startOidcLogin(undefined, { personalLicense: personalKey });
            }}
            data-testid="login-gate-personal-submit"
          >
            Sign in with individual seat
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
        Connect
      </Button>
      {!managedLogin && (
        <Button type="link" block onClick={onSkip} disabled={pending} data-testid="login-gate-skip">
          Skip — work locally
        </Button>
      )}
    </div>
  );
}
