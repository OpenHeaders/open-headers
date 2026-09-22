/**
 * The wizard's sign-in step (the client sign-in plan D4) — ONE shared
 * component over two seams, with no host branches inside it:
 *
 *   - the `serverSignIn` capability (start / poll / a meta read) —
 *     the extension fetches page-side from its own origin, the desktop
 *     renderer relays to its MAIN process (F0-b), the CLI is its own
 *     client;
 *   - the shared gate resolver, so the step knows what the server's
 *     own page will show before it sends the person there.
 *
 * Primary: **"Sign in on <host>"** — start a pair, open the server's
 * approval page through `openExternalUrl`, show the short code AND the
 * page's link with a copy affordance (the browser open is a convenience;
 * the person may paste the link into any browser they choose), and
 * poll on the handle until the person approves the device there. The
 * secret the poll answers is written onto the record like a pasted
 * token; the wizard's probe re-runs on that write, so the line flips to
 * "Signed in as <person> · <org>" off a REAL handshake (the one
 * activation path — the step itself connects nothing).
 *
 * Secondary: **"Have a pairing code or token from an administrator?"**
 * — the existing six-cell code + token paste, exactly as before, for
 * machines and admin-issued devices. It is the ONLY path when the host
 * registers no `serverSignIn`, when the server is in its no-login
 * state (the line says why), and under the require-NM posture. An
 * unclaimed server draws no sign-in at all: it says where the
 * administrator is created first.
 *
 * Cancel is client-side — the step stops polling; the server's pair
 * expires on its own five-minute clock, and a late verdict is never
 * read.
 */

import { getCapability, hasCapability, type ServerSignInApi } from '@openheaders/core/capabilities';
import { wsUrlToHttpOrigin } from '@openheaders/core/identity';
import type { MessageKey } from '@openheaders/i18n';
import { Alert, Button, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { type GateMode, resolveGateMode, urlHost } from '../../../shared/backend';
import { useNmIdentityRequired } from '../schema/backend';
import BackendAuthTokenField from './backend-auth-token-field';
import { useBackendRecord } from './backend-record-context';
import type { SignInVerdict } from './backend-wizard';

/** How often the handle is polled while the person is on the server's page. */
export const SIGN_IN_POLL_INTERVAL_MS = 2_000;

type FailureReason =
  | 'denied'
  | 'expired'
  | 'lost'
  | 'too-many-pending'
  | 'throttled'
  | 'forbidden'
  | 'offline'
  | 'error';

type Flow =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; code: string; pollToken: string; approveUrl: string; expiresAt: number }
  | { phase: 'failed'; reason: FailureReason };

const FAILURE_KEYS: Record<FailureReason, MessageKey> = {
  denied: 'workbench.settings.backendPane.wizard.signIn.fail.denied',
  expired: 'workbench.settings.backendPane.wizard.signIn.fail.expired',
  lost: 'workbench.settings.backendPane.wizard.signIn.fail.lost',
  'too-many-pending': 'workbench.settings.backendPane.wizard.signIn.fail.tooManyPending',
  throttled: 'workbench.settings.backendPane.wizard.signIn.fail.throttled',
  forbidden: 'workbench.settings.backendPane.wizard.signIn.fail.forbidden',
  offline: 'workbench.settings.backendPane.wizard.signIn.fail.offline',
  error: 'workbench.settings.backendPane.wizard.signIn.fail.generic',
};

export interface BackendSignInStepProps {
  verdict: SignInVerdict | null;
  probing: boolean;
  /** The wizard's probe — "Check again". */
  onProbe: () => void;
}

const BackendSignInStep: React.FC<BackendSignInStepProps> = ({ verdict, probing, onProbe }) => {
  const t = useT();
  const { token: themeToken } = theme.useToken();
  const handle = useBackendRecord();
  const url = handle?.record.url ?? '';
  const host = urlHost(url);
  const nmRequired = useNmIdentityRequired(url);
  const canSignIn = hasCapability('serverSignIn') && !nmRequired;
  const signedIn = verdict?.kind === 'signed-in';
  const [gate, setGate] = useState<GateMode | null>(null);
  const [flow, setFlow] = useState<Flow>({ phase: 'idle' });
  // The secondary path is shown on demand — and is the only path when
  // no sign-in can be offered.
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  // Only the latest poll may write — a Cancel or an unmount ends the loop
  // before a late answer lands.
  const pollSeq = useRef(0);

  // Ask the server how a person signs in there before offering to send
  // one; a null from every route reads as no-login, the honest default.
  useEffect(() => {
    setGate(null);
    if (!canSignIn || !url) return;
    const api = getCapability('serverSignIn')?.();
    if (!api) return;
    let cancelled = false;
    void resolveGateMode((path) => api.fetchMeta({ url, path })).then((mode) => {
      if (!cancelled) setGate(mode);
    });
    return () => {
      cancelled = true;
    };
  }, [canSignIn, url]);

  const openApproval = useCallback((approveUrl: string): void => {
    const open = getCapability('openExternalUrl');
    if (open) void open(approveUrl);
  }, []);

  const start = useCallback(async (): Promise<void> => {
    const api: ServerSignInApi | undefined = getCapability('serverSignIn')?.();
    if (!api || !url) return;
    setFlow({ phase: 'starting' });
    const started = await api.start({ url });
    if (!started.ok) {
      setFlow({ phase: 'failed', reason: started.reason });
      return;
    }
    setFlow({
      phase: 'waiting',
      code: started.code,
      pollToken: started.pollToken,
      approveUrl: started.approveUrl,
      expiresAt: started.expiresAt,
    });
    openApproval(started.approveUrl);
  }, [url, openApproval]);

  const cancel = useCallback((): void => {
    pollSeq.current += 1;
    setFlow({ phase: 'idle' });
  }, []);

  // The poll loop — alive exactly while the person is on the page.
  useEffect(() => {
    if (flow.phase !== 'waiting') return;
    const api = getCapability('serverSignIn')?.();
    if (!api || !handle) return;
    const seq = ++pollSeq.current;
    const { pollToken, expiresAt } = flow;
    let inFlight = false;
    const tick = async (): Promise<void> => {
      if (inFlight) return;
      inFlight = true;
      const polled = await api.poll({ url, pollToken });
      inFlight = false;
      if (seq !== pollSeq.current) return;
      switch (polled.status) {
        case 'approved':
          pollSeq.current += 1;
          setFlow({ phase: 'idle' });
          // The credential rides the same write a pasted token does; the
          // wizard's probe re-runs on it and names the person.
          void handle.patch({ authToken: polled.secret });
          return;
        case 'denied':
          setFlow({ phase: 'failed', reason: 'denied' });
          return;
        case 'expired':
          setFlow({ phase: 'failed', reason: 'expired' });
          return;
        case 'unknown':
          setFlow({ phase: 'failed', reason: 'lost' });
          return;
        default:
          // pending, or a transport hiccup worth polling past — until
          // the pair's own clock runs out.
          if (Date.now() > expiresAt) setFlow({ phase: 'failed', reason: 'expired' });
      }
    };
    const interval = setInterval(() => void tick(), SIGN_IN_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (seq === pollSeq.current) pollSeq.current += 1;
    };
  }, [flow, url, handle]);

  if (!handle) return null;

  const showPrimary = canSignIn && !signedIn && gate?.kind !== 'setup' && gate?.kind !== 'no-login';
  const secondaryOnly = !canSignIn || gate?.kind === 'no-login';
  const showSecondary = secondaryOnly || secondaryOpen;

  return (
    <div>
      <SignInVerdictLine verdict={verdict} probing={probing} host={host} />
      {canSignIn && gate?.kind === 'setup' && !signedIn && (
        <Alert
          type="info"
          showIcon
          title={t('workbench.settings.backendPane.wizard.signIn.unclaimed', { url: wsUrlToHttpOrigin(url) ?? host })}
          style={{ marginBottom: 10 }}
        />
      )}
      {canSignIn && gate?.kind === 'no-login' && !signedIn && (
        <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.noLogin', { host })} />
      )}
      {showPrimary && (
        <div style={{ padding: '4px 12px 10px' }}>
          {flow.phase === 'waiting' ? (
            <div>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1px solid ${themeToken.colorBorderSecondary}`,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    color: themeToken.colorTextTertiary,
                  }}
                >
                  {t('workbench.settings.backendPane.wizard.signIn.codeLabel')}
                </div>
                <div
                  data-testid="backend-sign-in-code"
                  style={{
                    fontSize: 32,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontWeight: 600,
                    letterSpacing: 6,
                    marginTop: 2,
                  }}
                >
                  {flow.code}
                </div>
              </div>
              <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.waiting')} />
              <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.linkHint')} />
              <Typography.Text
                data-testid="backend-sign-in-url"
                copyable={{
                  text: flow.approveUrl,
                  tooltips: [t('shared.action.copy'), t('shared.toast.copiedToClipboard')],
                }}
                style={{
                  display: 'block',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 12,
                  wordBreak: 'break-all',
                  marginBottom: 10,
                }}
              >
                {flow.approveUrl}
              </Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button onClick={cancel}>{t('shared.action.cancel')}</Button>
                <Typography.Link style={{ fontSize: 12 }} onClick={() => openApproval(flow.approveUrl)}>
                  {t('workbench.settings.backendPane.wizard.signIn.openAgain')}
                </Typography.Link>
              </div>
            </div>
          ) : (
            <div>
              {flow.phase === 'failed' && (
                <Alert
                  type="warning"
                  showIcon
                  title={t(FAILURE_KEYS[flow.reason], { host })}
                  style={{ marginBottom: 10 }}
                />
              )}
              <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.intro', { host })} />
              <Button
                type="primary"
                loading={flow.phase === 'starting' || gate === null}
                disabled={!url}
                onClick={() => void start()}
              >
                {t(
                  flow.phase === 'failed'
                    ? 'workbench.settings.backendPane.wizard.signIn.tryAgain'
                    : 'workbench.settings.backendPane.wizard.signIn.primary',
                  { host },
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      {showSecondary ? (
        <BackendAuthTokenField />
      ) : (
        <div style={{ padding: '2px 12px 8px' }}>
          <Typography.Link style={{ fontSize: 12 }} onClick={() => setSecondaryOpen(true)}>
            {t('workbench.settings.backendPane.wizard.signIn.secondary')}
          </Typography.Link>
        </div>
      )}
      <div style={{ padding: '8px 12px' }}>
        <Button loading={probing} onClick={onProbe}>
          {t('workbench.settings.backendPane.wizard.checkAgain')}
        </Button>
      </div>
    </div>
  );
};

export default BackendSignInStep;

const StepIntro: React.FC<{ text: string }> = ({ text }) => {
  const { token } = theme.useToken();
  return <p style={{ fontSize: 12.5, color: token.colorTextSecondary, margin: '0 0 10px' }}>{text}</p>;
};

/**
 * The step's one line: what the address answered. A probe in flight
 * reads as checking; an unanswered probe carries the shared probe
 * notice (the same copy Connect would fire), so the step never blocks.
 * A WELCOME that names the person reads "Signed in as <person> · <org>";
 * an unbound credential's names the Org only.
 */
const SignInVerdictLine: React.FC<{ verdict: SignInVerdict | null; probing: boolean; host: string }> = ({
  verdict,
  probing,
  host,
}) => {
  const t = useT();
  if (probing || !verdict) {
    return <StepIntro text={t('workbench.settings.backendPane.wizard.checking', { host })} />;
  }
  switch (verdict.kind) {
    case 'needs-pairing':
      return <StepIntro text={t('workbench.settings.backendPane.wizard.verdict.needsPairing', { host })} />;
    case 'signed-in':
      return <Alert type="success" showIcon title={signedInTitle(verdict, t)} style={{ marginBottom: 10 }} />;
    case 'unanswered':
      return (
        <Alert
          type={verdict.notice.level}
          showIcon
          title={verdict.notice.message}
          description={verdict.notice.description}
          style={{ marginBottom: 10 }}
        />
      );
  }
};

function signedInTitle(verdict: Extract<SignInVerdict, { kind: 'signed-in' }>, t: Translate): string {
  if (verdict.person && verdict.name) {
    return t('workbench.settings.backendPane.wizard.verdict.signedInAs', { person: verdict.person, name: verdict.name });
  }
  if (verdict.person) {
    return t('workbench.settings.backendPane.wizard.verdict.signedInAsUnnamed', { person: verdict.person });
  }
  return verdict.name
    ? t('workbench.settings.backendPane.wizard.verdict.signedIn', { name: verdict.name })
    : t('workbench.settings.backendPane.wizard.verdict.signedInUnnamed');
}
