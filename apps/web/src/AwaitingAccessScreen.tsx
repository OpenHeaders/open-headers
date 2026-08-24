/**
 * The A7 screen — rendered INSTEAD of the Workbench when this joined
 * tab holds zero workspaces (the server access plan A7). Reachable
 * when a signed-in user has every grant revoked, or an SSO arrival
 * matches no rule on a server whose floor was narrowed — rare once
 * admission confers access, but honest when it happens: the tab is a
 * replica, so with nothing granted there is nothing to invent.
 *
 * The state is LIVE by construction: `WorkbenchMount` derives
 * screen-vs-Workbench from the workspace list on every store change,
 * so this screen resolves in place the moment the first grant syncs
 * down — and takes over when an admin revokes the last workspace
 * mid-session. It names the server's Org, who is signed in (from the
 * ungated `oh.daemon.admin.status` probe — the caller's own identity),
 * says an administrator must grant a workspace, and offers sign-out.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getIdentitySnapshot, getOrgBackendBindings } from '@openheaders/core/identity';
import { useT } from '@openheaders/ui/context';
import { Button, Divider, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { DaemonWire } from '@/host/daemon-wire';
import { signOutWeb } from '@/host/sign-out';
import { WEB_DAEMON_BACKEND_ID } from '@/host/web-backend-id';
import { showTransitionOverlay } from '@/transition-overlay';

const CARD_STYLE: React.CSSProperties = {
  maxWidth: 400,
  margin: '18vh auto 0',
  padding: '32px 36px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

interface SignedInUser {
  readonly displayName: string;
  readonly email: string | null;
}

/** The Org this tab joined on its one backend, as the snapshot holds it. */
function joinedOrgName(): string | null {
  const bindings = getOrgBackendBindings();
  const snapshot = getIdentitySnapshot();
  if (!snapshot) return null;
  for (const [orgId, backendId] of bindings) {
    if (backendId === WEB_DAEMON_BACKEND_ID) {
      return snapshot.orgs.get(orgId)?.name ?? null;
    }
  }
  return null;
}

export interface AwaitingAccessScreenProps {
  wire: DaemonWire;
}

export function AwaitingAccessScreen({ wire }: AwaitingAccessScreenProps): React.JSX.Element {
  const t = useT();
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Who is signed in — the ungated visibility probe answers the
  // caller's own identity. The wire may still be dialing when the
  // screen mounts (a reload lands here before the background join
  // completes), so re-ask whenever a handshake reaches the daemon
  // until an answer lands.
  useEffect(() => {
    let cancelled = false;
    let asked = false;
    const ask = (): void => {
      if (asked) return;
      asked = true;
      void hostBridge
        .call('oh.daemon.admin.status')
        .then((resp) => {
          if (!cancelled && resp.user) setUser(resp.user);
        })
        .catch(() => {
          // Offline or refused — retry on the next completed handshake.
          asked = false;
        });
    };
    const unsubscribe = wire.subscribeHandshake((state) => {
      if (state === 'welcomed' || state === 'catching-up' || state === 'synced') ask();
    });
    ask();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [wire]);

  const orgName = joinedOrgName();
  let signedInLine: string | null = null;
  if (user !== null) {
    signedInLine =
      user.email !== null
        ? t('web.access.signedInAsWithEmail', { name: user.displayName, email: user.email })
        : t('web.access.signedInAs', { name: user.displayName });
  }

  return (
    <div style={CARD_STYLE} data-testid="awaiting-access-screen">
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t('web.access.title')}
      </Typography.Title>
      <Typography.Paragraph style={{ margin: 0 }} type="secondary">
        {orgName !== null ? t('web.access.intro', { org: orgName }) : t('web.access.introNoOrg')}
      </Typography.Paragraph>
      {signedInLine !== null && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }} data-testid="awaiting-access-identity">
          {signedInLine}
        </Typography.Text>
      )}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Spin size="small" />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('web.access.waiting')}
        </Typography.Text>
      </div>
      <Divider style={{ margin: 0 }} />
      <Button
        block
        loading={signingOut}
        onClick={() => {
          setSigningOut(true);
          showTransitionOverlay();
          void signOutWeb();
        }}
        data-testid="awaiting-access-sign-out"
      >
        {t('web.access.signOut')}
      </Button>
    </div>
  );
}
