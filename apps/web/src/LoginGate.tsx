/**
 * The served server's front door, rendered INSTEAD of the Workbench
 * when the serving daemon is reachable but this tab holds no session
 * yet. Whichever way in the visitor takes, the secret it yields rides
 * a real HELLO; only a WELCOME accept persists it and mounts the
 * Workbench.
 *
 * The card is a pure function of the server's own state (the front
 * door plan §4.1), resolved by `resolveGateMode`:
 *
 *   - **unclaimed** — nobody has set this server up, so the visitor
 *     creates the first administrator. Free from the server's own
 *     browser, proved by the boot's setup code from anywhere else.
 *   - **claimed, SSO** — sign in with the configured provider.
 *   - **claimed, local** — sign in with email and password.
 *   - **no-login** — claimed, no provider, and no account left holding
 *     a password. Nothing a browser can sign in with, said plainly
 *     rather than dressed up as a door.
 *
 * Two things the card deliberately does NOT offer. It once had a "work
 * locally" bypass, which this host cannot honor — the served tab's one
 * backend is fixed to the serving daemon (`WEB_DAEMON_BACKEND_ID`) and
 * the tenancy layer withholds the tab's home-Org data from it
 * structurally, so anything made in a skipped session could never
 * reach the server. And it no longer takes a pairing token: with the
 * claim shipped, every deployment has a way in a person can use, and
 * an unbound token pasted here would resolve to the operator and hand
 * this tab full administrative power around the directory entirely —
 * the very backdoor the claim revokes when it closes. `ohd show-token`
 * survives as what it is, the machine bootstrap for attaching a native
 * client to a headless box, and no `ohd` command is shown here.
 *
 * The native clients hold the bottom of the card on every state. The
 * point is not a way around the gate but that this tab is not the only
 * client: they dial `ws://<host>` from any machine with no browser
 * origin rules in the way, which is the ordinary shape of a headless
 * deployment. Each row is the install the visitor would actually
 * perform, resolved from this browser and this OS
 * (`gate-clients.ts`) — the extension's store listing and the desktop
 * download, not a menu of platforms to pick their own out of.
 */

import { readHostProbe } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context';
import { Alert, Button, Divider, Input, Typography } from 'antd';
import { useState } from 'react';
import { type GateClientTarget, markUrl, resolveDesktopTarget, resolveExtensionTargets } from '@/gate-clients';
import type { DaemonWire } from '@/host/daemon-wire';
import { type GateMode, submitDaemonToken } from '@/host/join-gate';
import { isSeatRefusalReason, oidcErrorKey, startOidcLogin } from '@/host/oidc-login';
import { submitPasswordLogin } from '@/host/password-login';
import {
  PASSWORD_MIN_LENGTH,
  type SetupClaimFieldError,
  setupClaimInvalidError,
  submitSetupClaim,
} from '@/host/setup-claim';
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
const FIELD_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const HINT_STYLE: React.CSSProperties = { fontSize: 12 };

/** An input with the message that belongs under it — server-typed or live. */
const Field: React.FC<{ error?: string | null; hint?: string; children: React.ReactNode }> = ({
  error,
  hint,
  children,
}) => (
  <div style={FIELD_STYLE}>
    {children}
    {error != null && (
      <Typography.Text type="danger" style={HINT_STYLE}>
        {error}
      </Typography.Text>
    )}
    {error == null && hint !== undefined && (
      <Typography.Text type="secondary" style={HINT_STYLE}>
        {hint}
      </Typography.Text>
    )}
  </div>
);

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
  /** Called once the daemon accepted the session (already persisted). */
  onJoined: () => void;
  /** Which front door the server's state asks this browser to draw. */
  mode: GateMode;
  /** Refusal reason of a failed SSO round-trip carried into the gate — keyed to its message here. */
  initialErrorReason?: string | null;
}

/** What the claim left behind, once it has committed and cannot be retried. */
interface ClaimOutcome {
  /** Paired devices the claim unpaired — they must pair again. */
  readonly revokedTokens: number;
  /** The session that followed was accepted; false means the admin exists but this tab is not in. */
  readonly joined: boolean;
}

export function LoginGate({ wire, onJoined, mode, initialErrorReason }: LoginGateProps): React.JSX.Element {
  const t = useT();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [personalKey, setPersonalKey] = useState('');
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState<ClaimOutcome | null>(null);
  const [invalid, setInvalid] = useState<SetupClaimFieldError | null>(null);
  const [error, setError] = useState<string | null>(
    initialErrorReason != null ? t(oidcErrorKey(initialErrorReason)) : null,
  );
  const ssoProvider = mode.kind === 'sso' ? mode.provider : null;
  // The seat wall is the conversion moment: offer the self-serve way in.
  const seatBlocked = ssoProvider !== null && isSeatRefusalReason(initialErrorReason);
  // Detection is a constant for the life of the tab — resolve once.
  const [{ extensionTargets, desktopTarget }] = useState(() => {
    const probe = readHostProbe(navigator);
    return { extensionTargets: resolveExtensionTargets(probe), desktopTarget: resolveDesktopTarget(probe) };
  });

  const canSubmitPassword = email.trim().length > 0 && password.length > 0;

  const submitPassword = async (): Promise<void> => {
    if (pending || !canSubmitPassword) return;
    setPending(true);
    setError(null);
    // The secret rides the candidate → HELLO → persist path: real
    // handshake, persisted only on WELCOME accept.
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

  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const canSubmitSetup =
    displayName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= PASSWORD_MIN_LENGTH &&
    confirmPassword === password;

  const submitSetup = async (): Promise<void> => {
    if (pending || !canSubmitSetup) return;
    setPending(true);
    setError(null);
    setInvalid(null);
    const claim = await submitSetupClaim({ displayName, email, password, code: setupCode });
    if (!claim.ok) {
      setPending(false);
      if (claim.kind === 'invalid') {
        // Only the field reasons have a field to sit under; a body the
        // route could not read belongs on the card's own error line.
        const typed = setupClaimInvalidError(claim.reason);
        if (typed.field === null) setError(t(typed.key));
        else setInvalid(typed);
        return;
      }
      setError(t(claim.kind === 'refused' ? 'web.gate.setupErrorRefused' : 'web.gate.errorServerOffline'));
      return;
    }
    // The claim mints an ordinary session — same path a password login
    // takes, and the only one this tab has.
    const joined = await submitDaemonToken(wire, claim.secret);
    setPending(false);
    // Committed either way: the directory is no longer empty, so the
    // form behind this can only meet the uniform refusal from here on.
    if (joined.ok && claim.revokedTokens === 0) {
      showTransitionOverlay(t('web.overlay.signingIn'));
      onJoined();
      return;
    }
    setClaimed({ revokedTokens: claim.revokedTokens, joined: joined.ok });
  };

  let passwordFieldError: string | null = null;
  if (passwordTooShort) passwordFieldError = t('web.gate.setupErrorPasswordShort', { min: PASSWORD_MIN_LENGTH });
  else if (invalid?.field === 'password') passwordFieldError = t(invalid.key, { min: PASSWORD_MIN_LENGTH });

  let titleKey: MessageKey = 'web.gate.titleSignIn';
  if (claimed !== null) titleKey = 'web.gate.setupDoneTitle';
  else if (mode.kind === 'setup') titleKey = 'web.gate.titleSetup';

  // Antd's Typography renders a single string child — build the line
  // here rather than letting unmatched branches emit `false` beside it.
  let introText = t('web.gate.introNoLogin');
  if (ssoProvider !== null) introText = t('web.gate.introSso', { provider: ssoProvider });
  else if (mode.kind === 'password') introText = t('web.gate.introPassword');
  else if (mode.kind === 'setup') introText = t('web.gate.introSetup');

  return (
    <div style={CARD_STYLE} data-testid="login-gate">
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t(titleKey)}
      </Typography.Title>
      {claimed !== null ? (
        <div style={FIELD_STYLE} data-testid="login-gate-setup-done">
          <Typography.Paragraph style={{ margin: 0 }} type="secondary">
            {claimed.joined
              ? t('web.gate.setupDoneRepair', { count: claimed.revokedTokens })
              : t('web.gate.setupErrorSessionRefused')}
          </Typography.Paragraph>
          <Button
            type="primary"
            block
            style={{ marginTop: 12 }}
            onClick={() => {
              if (!claimed.joined) {
                window.location.reload();
                return;
              }
              showTransitionOverlay(t('web.overlay.signingIn'));
              onJoined();
            }}
            data-testid="login-gate-setup-continue"
          >
            {t(claimed.joined ? 'web.gate.setupDoneContinue' : 'web.gate.setupDoneReload')}
          </Button>
        </div>
      ) : (
        <>
          <Typography.Paragraph style={{ margin: 0 }} type="secondary">
            {introText}
          </Typography.Paragraph>
          {ssoProvider !== null && (
            <Button
              type="primary"
              block
              onClick={() => {
                // Full-page redirect to the IdP — cover the beat before
                // the browser navigates so the click isn't a dead press.
                showTransitionOverlay(t('web.overlay.takingYouTo', { provider: ssoProvider }));
                startOidcLogin();
              }}
              disabled={pending}
              data-testid="login-gate-sso"
            >
              {t('web.gate.ssoButton', { provider: ssoProvider })}
            </Button>
          )}
          {mode.kind === 'password' && (
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
            </>
          )}
          {mode.kind === 'setup' && (
            <>
              <Field error={invalid?.field === 'displayName' ? t(invalid.key) : null}>
                <Input
                  autoFocus
                  data-testid="login-gate-setup-name"
                  placeholder={t('web.gate.setupNamePlaceholder')}
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setInvalid(null);
                  }}
                  disabled={pending}
                />
              </Field>
              <Field error={invalid?.field === 'email' ? t(invalid.key) : null}>
                <Input
                  type="email"
                  data-testid="login-gate-setup-email"
                  placeholder={t('web.gate.emailPlaceholder')}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setInvalid(null);
                  }}
                  disabled={pending}
                />
              </Field>
              <Field error={passwordFieldError} hint={t('web.gate.setupPasswordHint', { min: PASSWORD_MIN_LENGTH })}>
                <Input.Password
                  data-testid="login-gate-setup-password"
                  placeholder={t('web.gate.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setInvalid(null);
                  }}
                  disabled={pending}
                />
              </Field>
              <Field error={passwordMismatch ? t('web.gate.setupErrorPasswordMismatch') : null}>
                <Input.Password
                  data-testid="login-gate-setup-confirm"
                  placeholder={t('web.gate.setupConfirmPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onPressEnter={() => void submitSetup()}
                  disabled={pending}
                />
              </Field>
              {mode.requiresCode && (
                <Field hint={t('web.gate.setupCodeHint')}>
                  <Input
                    data-testid="login-gate-setup-code"
                    placeholder={t('web.gate.setupCodePlaceholder')}
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    onPressEnter={() => void submitSetup()}
                    disabled={pending}
                  />
                </Field>
              )}
              <Button
                type="primary"
                block
                loading={pending}
                disabled={!canSubmitSetup}
                onClick={() => void submitSetup()}
                data-testid="login-gate-setup-submit"
              >
                {t('web.gate.setupSubmit')}
              </Button>
            </>
          )}
          {error && <Alert type="error" showIcon message={error} data-testid="login-gate-error" />}
          {seatBlocked && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="login-gate-personal-seat">
              <Typography.Text type="secondary" style={HINT_STYLE}>
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
        </>
      )}
      <Divider style={{ margin: 0 }} />
      <div style={CLIENTS_STYLE} data-testid="login-gate-native-clients">
        <Typography.Text type="secondary" style={HINT_STYLE}>
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
        <Typography.Link href={`https://${DOCS_QUICKSTART}`} target="_blank" style={HINT_STYLE}>
          {DOCS_QUICKSTART}
        </Typography.Link>
      </div>
    </div>
  );
}
