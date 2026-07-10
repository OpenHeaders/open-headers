/**
 * Minimal pairing gate rendered INSTEAD of the Workbench when the
 * serving daemon is reachable but this tab holds no paired token yet.
 * A submitted token rides a real HELLO; only a WELCOME accept persists
 * it and mounts the Workbench. "Work locally" keeps the tab
 * offline-first without pairing.
 */

import { Alert, Button, Divider, Input, Typography } from 'antd';
import { useState } from 'react';
import type { DaemonWire } from '@/host/daemon-wire';
import { submitDaemonToken } from '@/host/join-gate';
import { startOidcLogin } from '@/host/oidc-login';

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
  /** Error carried into the gate (e.g. a failed SSO round-trip). */
  initialError?: string | null;
}

export function LoginGate({ wire, onJoined, onSkip, ssoProvider, initialError }: LoginGateProps): React.JSX.Element {
  const [token, setToken] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

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

  return (
    <div style={CARD_STYLE} data-testid="login-gate">
      <Typography.Title level={4} style={{ margin: 0 }}>
        Pair with this daemon
      </Typography.Title>
      <Typography.Paragraph style={{ margin: 0 }} type="secondary">
        This OpenHeaders daemon requires a pairing token. Mint one on the machine running it with{' '}
        <Typography.Text code>oh daemon show-token</Typography.Text> and paste it below.
      </Typography.Paragraph>
      {ssoProvider && (
        <>
          <Button block onClick={() => startOidcLogin()} disabled={pending} data-testid="login-gate-sso">
            Sign in with {ssoProvider}
          </Button>
          <Divider plain style={{ margin: 0 }}>
            or
          </Divider>
        </>
      )}
      <Input.Password
        autoFocus
        data-testid="login-gate-token"
        placeholder="Pairing token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onPressEnter={() => void submit()}
        disabled={pending}
      />
      {error && <Alert type="error" showIcon message={error} data-testid="login-gate-error" />}
      <Button
        type="primary"
        block
        loading={pending}
        disabled={token.trim().length === 0}
        onClick={() => void submit()}
        data-testid="login-gate-submit"
      >
        Connect
      </Button>
      <Button type="link" block onClick={onSkip} disabled={pending} data-testid="login-gate-skip">
        Skip — work locally
      </Button>
    </div>
  );
}
