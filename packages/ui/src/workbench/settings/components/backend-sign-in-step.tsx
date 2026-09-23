/**
 * The wizard's sign-in step (the client sign-in plan D4, §14.9) — ONE
 * shared component over two seams, with no host branches inside it:
 *
 *   - the `serverSignIn` capability (start / poll / cancel / a meta
 *     read) — answered by the host's long-lived process (the desktop's
 *     MAIN, the extension's service worker) over the bridge; the CLI
 *     is its own client;
 *   - the shared gate resolver, so the step knows what the server's
 *     own page will show before it sends the person there.
 *
 * Primary: **"Sign in on <host>"** — the host starts the grant its
 * registration allows and answers which one it is running:
 *   - `redirect` (the authorization code grant): the host has already
 *     opened the browser and will collect the redirect itself — the
 *     step shows a waiting line and Cancel, nothing else to do here;
 *   - `device` (the device grant): the step shows the user code AND the
 *     verification link with a copy affordance (the browser open is a
 *     convenience; the person may paste the link into any browser they
 *     choose).
 * Either way it polls the handle until the flow settles. The secret an
 * approval answers is written onto the record like a pasted token; the
 * wizard's probe re-runs on that write, so the line flips to "Signed in
 * as <person> · <org>" off a REAL handshake (the one activation path —
 * the step itself connects nothing).
 *
 * Secondary: **"Have a pairing code or token from an administrator?"**
 * — the existing six-cell code + token paste, exactly as before, for
 * machines and admin-issued devices. It is the ONLY path when the host
 * registers no `serverSignIn`, when the server is in its no-login
 * state (the line says why), and under the require-NM posture. An
 * unclaimed server draws no sign-in at all: it says where the
 * administrator is created first.
 *
 * Cancel is client-side — the step stops polling and the host forgets
 * the handle; the server's record expires on its own clock, and a late
 * verdict is never read.
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

/** The step reads as one centred column — the line, the offer, the way around it, the re-check. */
const STEP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 4,
};
const BLOCK_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center' };
/** A banner or a form spans the column. */
const STRETCH_STYLE: React.CSSProperties = { alignSelf: 'stretch' };

type FailureReason =
  | 'denied'
  | 'expired'
  | 'abandoned'
  | 'lost'
  | 'too-many-pending'
  | 'throttled'
  | 'forbidden'
  | 'offline'
  | 'error';

/** What the person sees while the host runs the grant — nothing for the code grant, the code and the link for the device grant. */
type WaitingGrant = { kind: 'redirect' } | { kind: 'device'; code: string; link: string };

type Flow =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; handle: string; expiresAt: number; grant: WaitingGrant }
  | { phase: 'failed'; reason: FailureReason };

const FAILURE_KEYS: Record<FailureReason, MessageKey> = {
  denied: 'workbench.settings.backendPane.wizard.signIn.fail.denied',
  expired: 'workbench.settings.backendPane.wizard.signIn.fail.expired',
  abandoned: 'workbench.settings.backendPane.wizard.signIn.fail.abandoned',
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
    if (started.kind === 'redirect') {
      setFlow({ phase: 'waiting', handle: started.handle, expiresAt: started.expiresAt, grant: { kind: 'redirect' } });
      return;
    }
    setFlow({
      phase: 'waiting',
      handle: started.handle,
      expiresAt: started.expiresAt,
      grant: { kind: 'device', code: started.userCode, link: started.verificationUriComplete },
    });
    openApproval(started.verificationUriComplete);
  }, [url, openApproval]);

  const cancel = useCallback((): void => {
    pollSeq.current += 1;
    if (flow.phase === 'waiting') void getCapability('serverSignIn')?.().cancel({ handle: flow.handle });
    setFlow({ phase: 'idle' });
  }, [flow]);

  // The poll loop — alive exactly while the person is on the page.
  useEffect(() => {
    if (flow.phase !== 'waiting') return;
    const api = getCapability('serverSignIn')?.();
    if (!api || !handle) return;
    const seq = ++pollSeq.current;
    const { handle: flowHandle, expiresAt } = flow;
    let inFlight = false;
    const tick = async (): Promise<void> => {
      if (inFlight) return;
      inFlight = true;
      const polled = await api.poll({ handle: flowHandle });
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
        case 'abandoned':
          setFlow({ phase: 'failed', reason: 'abandoned' });
          return;
        case 'unknown':
          setFlow({ phase: 'failed', reason: 'lost' });
          return;
        default:
          // pending, or a transport hiccup worth polling past — until
          // the flow's own clock runs out. The host squelches an early
          // dial on the device grant, so this cadence never outruns the
          // server's interval.
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

  // A WELCOME that named the person answers the step: nothing left to
  // start, paste or re-check — the line stands alone and Next takes over.
  if (signedIn) {
    return (
      <div style={STEP_STYLE}>
        <SignInVerdictLine verdict={verdict} probing={probing} host={host} />
      </div>
    );
  }

  const showPrimary = canSignIn && gate?.kind !== 'setup' && gate?.kind !== 'no-login';
  const secondaryOnly = !canSignIn || gate?.kind === 'no-login';
  const showSecondary = secondaryOnly || secondaryOpen;

  return (
    <div style={STEP_STYLE}>
      <SignInVerdictLine verdict={verdict} probing={probing} host={host} />
      {canSignIn && gate?.kind === 'setup' && (
        <Alert
          type="info"
          showIcon
          title={t('workbench.settings.backendPane.wizard.signIn.unclaimed', { url: wsUrlToHttpOrigin(url) ?? host })}
          style={{ ...STRETCH_STYLE, marginBottom: 10 }}
        />
      )}
      {canSignIn && gate?.kind === 'no-login' && (
        <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.noLogin', { host })} />
      )}
      {showPrimary && (
        <div style={{ ...STRETCH_STYLE, padding: '4px 12px 6px' }}>
          {flow.phase === 'waiting' ? (
            flow.grant.kind === 'redirect' ? (
              <div style={BLOCK_STYLE}>
                <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.waitingBrowser')} />
                <Button onClick={cancel}>{t('shared.action.cancel')}</Button>
              </div>
            ) : (
              <DeviceWaiting code={flow.grant.code} link={flow.grant.link} onCancel={cancel} onOpen={openApproval} />
            )
          ) : (
            <div style={BLOCK_STYLE}>
              {flow.phase === 'failed' && (
                <Alert
                  type="warning"
                  showIcon
                  title={t(FAILURE_KEYS[flow.reason], { host })}
                  style={{ ...STRETCH_STYLE, marginBottom: 10 }}
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
        <div style={{ ...STRETCH_STYLE, textAlign: 'start' }}>
          <BackendAuthTokenField />
        </div>
      ) : (
        <Typography.Link style={{ fontSize: 12 }} onClick={() => setSecondaryOpen(true)}>
          {t('workbench.settings.backendPane.wizard.signIn.secondary')}
        </Typography.Link>
      )}
      <Button type="link" size="small" loading={probing} onClick={onProbe}>
        {t('workbench.settings.backendPane.wizard.checkAgain')}
      </Button>
    </div>
  );
};

export default BackendSignInStep;

const StepIntro: React.FC<{ text: string }> = ({ text }) => {
  const { token } = theme.useToken();
  return <p style={{ fontSize: 12.5, color: token.colorTextSecondary, margin: '0 0 10px' }}>{text}</p>;
};

/**
 * The device grant's waiting state: the user code the consent page will
 * show (RFC 8628 §5.4 — the person checks it matches), the waiting
 * line, and the verification link with a copy affordance beside Cancel
 * and an open-again link.
 */
const DeviceWaiting: React.FC<{
  code: string;
  link: string;
  onCancel: () => void;
  onOpen: (link: string) => void;
}> = ({ code, link, onCancel, onOpen }) => {
  const t = useT();
  const { token: themeToken } = theme.useToken();
  return (
    <div style={BLOCK_STYLE}>
      <div
        style={{
          ...STRETCH_STYLE,
          textAlign: 'center',
          padding: '12px 16px',
          borderRadius: 10,
          border: `1px solid ${themeToken.colorBorderSecondary}`,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: themeToken.colorTextTertiary }}>
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
          {code}
        </div>
      </div>
      <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.waiting')} />
      <StepIntro text={t('workbench.settings.backendPane.wizard.signIn.linkHint')} />
      <Typography.Text
        data-testid="backend-sign-in-url"
        copyable={{ text: link, tooltips: [t('shared.action.copy'), t('shared.toast.copiedToClipboard')] }}
        style={{
          display: 'block',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          wordBreak: 'break-all',
          marginBottom: 10,
        }}
      >
        {link}
      </Typography.Text>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Button onClick={onCancel}>{t('shared.action.cancel')}</Button>
        <Typography.Link style={{ fontSize: 12 }} onClick={() => onOpen(link)}>
          {t('workbench.settings.backendPane.wizard.signIn.openAgain')}
        </Typography.Link>
      </div>
    </div>
  );
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
      return (
        <Alert
          type="success"
          showIcon
          title={signedInTitle(verdict, t)}
          style={{ ...STRETCH_STYLE, textAlign: 'start', marginBottom: 10 }}
        />
      );
    case 'unanswered':
      return (
        <Alert
          type={verdict.notice.level}
          showIcon
          title={verdict.notice.message}
          description={verdict.notice.description}
          style={{ ...STRETCH_STYLE, textAlign: 'start', marginBottom: 10 }}
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
