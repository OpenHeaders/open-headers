/**
 * The consent card (the client sign-in plan §14.4) — rendered INSTEAD
 * of the Workbench when this tab was sent a pending authorization to
 * decide: a native client (the extension, the desktop app, the CLI)
 * asked to sign in to this server as a person, and the browser's
 * EXISTING session is the approver. The person never retypes a
 * credential the browser already holds.
 *
 * The card reads the way an authorization page does everywhere else:
 * the product mark, WHAT asks (the registered client, the device label
 * the client sent) in the title, one line on what allowing means, the
 * user code on the device grant to check against the device (RFC 8628
 * §5.4), a primary Allow over a quiet Decline, and under them who the
 * approval would sign the device in as (the session's person, from the
 * same probe the awaiting-access screen reads) with the way to switch
 * to someone else — the sign-out that keeps the decision pending, so
 * the gate draws and hands back to this card. Allow carries the
 * session bearer: on the code grant the tab leaves for the client's
 * registered redirect — opaque here, navigated and never parsed; on
 * the device grant the record settles and the device's poll takes it
 * from there. Decline settles the record and, on the code grant, takes
 * the same road with the refusal (RFC 6749 §4.1.2.1), so the client's
 * window closes on a no as it does on a yes. A refused bearer means the
 * session is stale: the tab drops it and re-gates with the id kept, the
 * same path as the switch.
 *
 * The request's address is not drawn. The server-rendered page
 * compares the asking peer with the approving browser's and draws the
 * line only when they differ; this tab cannot see its own peer, and
 * printing one address on every card is the alarm S6 retired.
 *
 * The settled states mirror the server-rendered page's verdicts; since
 * this tab IS the app, each also offers the way on to the Workbench.
 */

import type { AuthorizationFacts } from '@openheaders/core/identity';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context';
import {
  reprobeServerAdminStatus,
  useServerAdminIdentity,
} from '@openheaders/ui/workbench/components/server-admin/use-server-admin-status';
import { Alert, Button, Divider, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { GateCard } from '@/GateCard';
import {
  type AuthorizationRead,
  approveAuthorization,
  type ConsentState,
  consentStateFromRead,
  consentStateFromRefusal,
  denyAuthorization,
  fetchAuthorizationFacts,
  type PendingAuthorization,
  reGateWithAuthorization,
} from '@/host/authorize-consent';
import type { DaemonWire } from '@/host/daemon-wire';
import { oidcErrorKey } from '@/host/oidc-login';
import { showTransitionOverlay } from '@/transition-overlay';

const CENTERED: React.CSSProperties = { margin: 0, textAlign: 'center' };
const HINT_STYLE: React.CSSProperties = { fontSize: 12, textAlign: 'center' };
const DECISION_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const WHO_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  fontSize: 12,
};

const CLIENT_KEY: Readonly<Record<AuthorizationFacts['clientKind'], MessageKey>> = {
  desktop: 'web.consent.clientDesktop',
  extension: 'web.consent.clientExtension',
  cli: 'web.consent.clientCli',
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The verdict page of a settled record — its title and its one sentence. */
const SETTLED_COPY: Readonly<
  Record<Exclude<ConsentState['kind'], 'pending'>, { title: MessageKey; body: MessageKey }>
> = {
  approved: { title: 'web.consent.approvedTitle', body: 'web.consent.approvedBody' },
  denied: { title: 'web.consent.deniedTitle', body: 'web.consent.deniedBody' },
  expired: { title: 'web.consent.expiredTitle', body: 'web.consent.expiredBody' },
  unknown: { title: 'web.consent.notFoundTitle', body: 'web.consent.notFoundBody' },
  offline: { title: 'web.consent.offlineTitle', body: 'web.gate.errorServerOffline' },
};

export interface ConsentCardProps {
  wire: DaemonWire;
  pending: PendingAuthorization;
  /** The record as the boot already read it; absent, the card reads it once itself. */
  read?: AuthorizationRead;
  /** The way on from a settled verdict — the Workbench, or the gate when this tab holds no session. */
  onContinue: () => void;
}

export function ConsentCard({ wire, pending, read, onContinue }: ConsentCardProps): React.JSX.Element {
  const t = useT();
  const [state, setState] = useState<ConsentState | null>(read === undefined ? null : consentStateFromRead(read));
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(
    pending.error !== undefined ? t(oidcErrorKey(pending.error)) : null,
  );
  const identity = useServerAdminIdentity();

  // The record's public facts, read once — a decision settles the
  // state locally from the server's answer, never by re-reading.
  useEffect(() => {
    if (read !== undefined) return;
    let cancelled = false;
    void fetchAuthorizationFacts(pending.id).then((fetched) => {
      if (!cancelled) setState(consentStateFromRead(fetched));
    });
    return () => {
      cancelled = true;
    };
  }, [pending.id, read]);

  // Who the approval signs the device in as — the probe rides the wire,
  // so re-ask the moment a handshake completes (the mount's idiom).
  useEffect(() => {
    const reprobeIfReady = (handshake: ReturnType<DaemonWire['handshakeState']>): void => {
      if (handshake === 'welcomed' || handshake === 'catching-up' || handshake === 'synced') {
        reprobeServerAdminStatus();
      }
    };
    const unsubscribe = wire.subscribeHandshake(reprobeIfReady);
    reprobeIfReady(wire.handshakeState());
    return unsubscribe;
  }, [wire]);

  const allow = async (facts: AuthorizationFacts): Promise<void> => {
    if (deciding) return;
    setDeciding(true);
    setError(null);
    const outcome = await approveAuthorization(pending.id);
    if (outcome.ok) {
      if (outcome.redirectTo !== null) {
        // The code grant: the tab leaves for the client's registered
        // redirect. Cover the beat before the browser navigates.
        showTransitionOverlay(t('web.overlay.takingYouBack', { client: t(CLIENT_KEY[facts.clientKind]) }));
        window.location.assign(outcome.redirectTo);
        return;
      }
      setDeciding(false);
      setState({ kind: 'approved' });
      return;
    }
    if (outcome.reason === 'session-refused') {
      // The session this tab holds is stale — never retried blindly.
      showTransitionOverlay();
      await reGateWithAuthorization(pending.id);
      return;
    }
    setDeciding(false);
    if (outcome.reason === 'offline') {
      setError(t('web.gate.errorServerOffline'));
      return;
    }
    setState(consentStateFromRefusal(outcome.reason));
  };

  const decline = async (facts: AuthorizationFacts): Promise<void> => {
    if (deciding) return;
    setDeciding(true);
    setError(null);
    const outcome = await denyAuthorization(pending.id);
    if (outcome.ok) {
      if (outcome.redirectTo !== null) {
        // The code grant: the refusal rides the client's registered
        // redirect, and the browser leg closes the way an approval does.
        showTransitionOverlay(t('web.overlay.takingYouBack', { client: t(CLIENT_KEY[facts.clientKind]) }));
        window.location.assign(outcome.redirectTo);
        return;
      }
      setDeciding(false);
      setState({ kind: 'denied' });
      return;
    }
    setDeciding(false);
    if (outcome.reason === 'offline') {
      setError(t('web.gate.errorServerOffline'));
      return;
    }
    setState(consentStateFromRefusal(outcome.reason));
  };

  // Someone else's session: drop it and come back to this decision
  // through the gate — the stale-bearer path, taken on purpose.
  const switchAccount = (): void => {
    if (deciding) return;
    setDeciding(true);
    showTransitionOverlay();
    void reGateWithAuthorization(pending.id);
  };

  if (state === null) {
    return (
      <GateCard testId="consent-card">
        <Spin size="small" />
      </GateCard>
    );
  }

  if (state.kind !== 'pending') {
    const copy = SETTLED_COPY[state.kind];
    return (
      <GateCard testId="consent-card" state={state.kind}>
        <Typography.Title level={4} style={CENTERED}>
          {t(copy.title)}
        </Typography.Title>
        <Typography.Paragraph style={CENTERED} type="secondary" data-testid="consent-card-state">
          {t(copy.body)}
        </Typography.Paragraph>
        {error && <Alert type="error" showIcon message={error} data-testid="consent-card-error" />}
        <Button block onClick={onContinue} data-testid="consent-card-continue">
          {t('web.consent.continue')}
        </Button>
      </GateCard>
    );
  }

  const { facts } = state;
  const client = t(CLIENT_KEY[facts.clientKind]);
  const label = facts.deviceLabel?.trim();
  const who = label ? t('web.consent.whoLabelled', { device: label, client }) : capitalize(client);
  const minutes = Math.max(0, Math.round((facts.expiresAt - Date.now()) / 60000));
  let signedInAs: string | null = null;
  if (identity !== null) {
    signedInAs =
      identity.email !== null
        ? t('web.access.signedInAsWithEmail', { name: identity.displayName, email: identity.email })
        : t('web.access.signedInAs', { name: identity.displayName });
  }

  return (
    <GateCard testId="consent-card" state="pending">
      <Typography.Title level={4} style={CENTERED} data-testid="consent-card-asks">
        {t('web.consent.wouldSignIn', { who })}
      </Typography.Title>
      <Typography.Paragraph style={CENTERED} type="secondary">
        {t('web.consent.grantBody')}
      </Typography.Paragraph>
      {facts.userCode !== undefined && (
        <Typography.Paragraph style={CENTERED} data-testid="consent-card-code">
          {t('web.consent.code', { code: facts.userCode })}
        </Typography.Paragraph>
      )}
      <Typography.Text type="secondary" style={HINT_STYLE}>
        {t('web.consent.expires', { minutes })}
      </Typography.Text>
      {error && <Alert type="error" showIcon message={error} data-testid="consent-card-error" />}
      <div style={DECISION_STYLE}>
        <Button
          type="primary"
          block
          size="large"
          loading={deciding}
          onClick={() => void allow(facts)}
          data-testid="consent-card-allow"
        >
          {t('web.consent.allow')}
        </Button>
        <Button
          type="text"
          block
          disabled={deciding}
          onClick={() => void decline(facts)}
          data-testid="consent-card-deny"
        >
          {t('web.consent.decline')}
        </Button>
      </div>
      {signedInAs !== null && (
        <>
          <Divider style={{ margin: 0 }} />
          <div style={WHO_STYLE}>
            <Typography.Text type="secondary" style={HINT_STYLE} data-testid="consent-card-identity">
              {signedInAs}
            </Typography.Text>
            <Typography.Link
              style={HINT_STYLE}
              disabled={deciding}
              onClick={switchAccount}
              data-testid="consent-card-switch-account"
            >
              {t('web.consent.switchAccount')}
            </Typography.Link>
          </div>
        </>
      )}
    </GateCard>
  );
}
