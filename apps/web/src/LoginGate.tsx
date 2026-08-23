/**
 * Minimal pairing gate rendered INSTEAD of the Workbench when the
 * serving daemon is reachable but this tab holds no paired token yet.
 * A submitted token rides a real HELLO; only a WELCOME accept persists
 * it and mounts the Workbench.
 *
 * The gate is a gate: pairing is the only way past it. It once offered
 * a "work locally" bypass, which this host cannot honor — the served
 * tab's one backend is fixed to the serving daemon
 * (`WEB_DAEMON_BACKEND_ID`), and the tenancy layer withholds the tab's
 * home-Org data from it structurally, so anything made in a skipped
 * session could never reach the server, not even after a later pairing.
 * On the server's own front door that read as a way in and was a
 * one-way door into a replica stranded at this origin.
 *
 * The native clients take its place at the bottom of the card. They
 * pair with the same token — the point is not a way around the gate but
 * that this tab is not the only client: they dial `ws://<host>` from any
 * machine with no browser origin rules in the way, which is the ordinary
 * shape of a headless deployment.
 *
 * Each row is the install the visitor would actually perform, resolved
 * from this browser and this OS (`gate-clients.ts`) — the extension's
 * store listing and the desktop download, not a menu of platforms to
 * pick their own out of.
 */

import { readHostProbe } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context';
import { Alert, Button, Divider, Input, Typography } from 'antd';
import { useState } from 'react';
import { type GateClientTarget, markUrl, resolveDesktopTarget, resolveExtensionTargets } from '@/gate-clients';
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

const DOCS_QUICKSTART = 'docs.openheaders.com/quickstart/server';

const CLIENTS_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const CLIENT_ROW_STYLE: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8 };

/**
 * One install row: the mark, what it is, and the brand it resolved to.
 * The mark repeats the brand name beside it, so it is decorative and a
 * screen reader reads the row's own words instead.
 */
const ClientRow: React.FC<{ label: string; target: GateClientTarget; testId: string }> = ({
  label,
  target,
  testId,
}) => (
  <Typography.Link href={target.url} target="_blank" style={CLIENT_ROW_STYLE} data-testid={testId}>
    <img src={markUrl(target)} width={16} height={16} alt="" aria-hidden="true" />
    <span style={{ fontSize: 12 }}>{target.name === null ? label : `${label} — ${target.name}`}</span>
  </Typography.Link>
);

export interface LoginGateProps {
  wire: DaemonWire;
  /** Called once the daemon accepted the token (already persisted). */
  onJoined: () => void;
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
  // Detection is a constant for the life of the tab — resolve once.
  const [{ extensionTargets, desktopTarget }] = useState(() => {
    const probe = readHostProbe(navigator);
    return { extensionTargets: resolveExtensionTargets(probe), desktopTarget: resolveDesktopTarget(probe) };
  });

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
  // gets in: the card titles itself "sign in", and the token field drops
  // to the secondary action behind whichever managed form is offered.
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
      <Divider style={{ margin: 0 }} />
      <div style={CLIENTS_STYLE} data-testid="login-gate-native-clients">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('web.gate.clientsIntro')} <Typography.Text code>{`ws://${window.location.host}`}</Typography.Text>
        </Typography.Text>
        {extensionTargets.map((target) => (
          <ClientRow
            key={target.url}
            label={t('web.gate.clientsExtension')}
            target={target}
            testId="login-gate-client-extension"
          />
        ))}
        <ClientRow label={t('web.gate.clientsDesktop')} target={desktopTarget} testId="login-gate-client-desktop" />
        {/* Link text IS the URL — a reader may only be able to retype it. */}
        <Typography.Link href={`https://${DOCS_QUICKSTART}`} target="_blank" style={{ fontSize: 12 }}>
          {DOCS_QUICKSTART}
        </Typography.Link>
      </div>
    </div>
  );
}
