/**
 * OrgWorkspaceAccessNotice — the zero-grant landing's explained state
 * plus the live grant-arrival announcement.
 *
 * A tab can be org-connected (its host joined a backend's Org) while
 * holding zero granted workspaces — the join is harmless-until-granted,
 * so the user keeps a fully usable local workspace and would otherwise
 * get pure silence. Two derived behaviors, no imperative state:
 *
 *   - While a joined Org has no synced-down workspace, a persistent
 *     non-blocking banner explains the state. It resolves in place the
 *     moment a workspace arrives (the condition derives from the
 *     workspace list, nothing is cached). It offers the server's own
 *     page — where the person sees what they hold and an admin grants —
 *     and can be dismissed per Org; a dismissal is forgotten the moment
 *     that Org grants something, so a later revoke-to-zero shows it again.
 *   - When a workspace of a joined Org arrives mid-session (the
 *     grant-time offer re-fanning the row down the live wire), it is
 *     announced — a toast with an open action plus a timeline entry —
 *     and the navigator picks it up from the same store change. No
 *     automatic context switch.
 *
 * Announcements skip the first hydrated render so a plain reload with
 * existing grants stays quiet; a null identity snapshot (renderer
 * mirror not hydrated yet) defers that baseline instead of treating
 * every pre-hydration workspace as newly arrived.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import { pushNotification } from '@openheaders/ui/shared/notifications';
import { Alert, App, Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useIdentitySnapshot } from '../../../shared/hooks/useIdentitySnapshot';
import { openServerPage, serverPageForOrg } from '../../../shared/workspace-org/server-page';
import { renderWorkspacePrefix } from './workspace-prefix';

// Grants announced at least once on this browser. A fresh login
// re-syncs the same workspace down every time, so without a durable
// record the arrival toast would fire on every sign-in — persist the
// ids so each grant is announced once, not once per session.
const ANNOUNCED_GRANTS_KEY = 'oh.announcedWorkspaceGrants';

function readAnnouncedGrants(): Set<string> {
  try {
    const raw = window.localStorage.getItem(ANNOUNCED_GRANTS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markGrantAnnounced(id: string): void {
  try {
    const set = readAnnouncedGrants();
    set.add(id);
    window.localStorage.setItem(ANNOUNCED_GRANTS_KEY, JSON.stringify([...set]));
  } catch {
    // Storage unavailable — the grant simply re-announces next session.
  }
}

// Orgs whose zero-grant banner the person closed. Kept per browser so a
// reload does not re-open it; dropped for an Org the moment it grants.
const DISMISSED_BANNERS_KEY = 'oh.dismissedZeroGrantBanners';

function readDismissedBanners(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_BANNERS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDismissedBanners(set: Set<string>): void {
  try {
    window.localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify([...set]));
  } catch {
    // Storage unavailable — the banner simply returns next session.
  }
}

// Compact single-line toast text — small fonts, truncate long
// workspace names with an ellipsis rather than wrapping.
const ONE_LINE: React.CSSProperties = {
  display: 'block',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const TOAST_TITLE_STYLE: React.CSSProperties = { ...ONE_LINE, fontSize: 13, fontWeight: 600 };
const TOAST_DESC_STYLE: React.CSSProperties = { ...ONE_LINE, fontSize: 12 };

interface OrgWorkspaceAccessNoticeProps {
  workspaces: ExtensionWorkspace[];
  /**
   * The workspace this session is currently on. When a grant arrives for
   * the workspace already active — e.g. a fresh login adopted the
   * daemon's active workspace (join → adopt) — the announcement drops
   * its "Open workspace" action, which would be a no-op switch, and
   * acknowledges the access in place instead.
   */
  activeWorkspaceId: string | null;
  /** Switch THIS tab to the arrived workspace (the announcement's action). */
  onSwitchWorkspace: (id: string) => void;
}

const OrgWorkspaceAccessNotice: React.FC<OrgWorkspaceAccessNoticeProps> = ({
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
}) => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const t = useT();
  const snapshot = useIdentitySnapshot();
  const bindings = getOrgBackendBindings();
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissedBanners);

  const consumed = workspaces.filter((ws) => bindings.has(ws.orgId));
  const consumedKey = consumed
    .map((ws) => ws.id)
    .sort()
    .join('|');
  const hydrated = snapshot !== null;

  // Workspace ids already seen this session — the baseline is taken on
  // the first hydrated render so only genuine mid-session arrivals
  // announce.
  const knownIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (knownIdsRef.current === null) {
      knownIdsRef.current = new Set(consumed.map((ws) => ws.id));
      return;
    }
    const known = knownIdsRef.current;
    for (const ws of consumed) {
      if (known.has(ws.id)) continue;
      known.add(ws.id);
      // Announce each grant once per browser, not once per login.
      if (readAnnouncedGrants().has(ws.id)) continue;
      markGrantAnnounced(ws.id);
      // Already on this workspace (a login adopted it) ⇒ acknowledge in
      // place with no "Open workspace" action, which would switch to the
      // workspace already open and so do nothing.
      const alreadyActive = ws.id === activeWorkspaceId;
      const toastKey = `org-workspace-arrival-${ws.id}`;
      notification.success({
        key: toastKey,
        placement: 'bottomRight',
        style: { width: 380 },
        title: (
          <span style={TOAST_TITLE_STYLE}>
            {alreadyActive
              ? t('workbench.workspace.grant.arrivedActiveTitle')
              : t('workbench.workspace.grant.arrivedTitle')}
          </span>
        ),
        description: (
          <span
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            data-testid={`org-workspace-arrival-${ws.id}`}
          >
            {renderWorkspacePrefix({ icon: ws.icon, color: ws.color }, token, { size: 16 })}
            <span style={TOAST_DESC_STYLE}>{ws.name}</span>
          </span>
        ),
        btn: alreadyActive ? undefined : (
          <Button
            type="primary"
            size="small"
            data-testid={`org-workspace-arrival-open-${ws.id}`}
            onClick={() => {
              onSwitchWorkspace(ws.id);
              notification.destroy(toastKey);
            }}
          >
            {t('workbench.workspace.grant.open')}
          </Button>
        ),
        duration: 8,
      });
      pushNotification({
        severity: 'success',
        title: alreadyActive
          ? t('workbench.workspace.grant.notifTitleActive', { name: ws.name })
          : t('workbench.workspace.grant.notifTitle', { name: ws.name }),
        description: alreadyActive
          ? t('workbench.workspace.grant.notifBodyActive')
          : t('workbench.workspace.grant.notifBody'),
        dedupeKey: `org-workspace-arrived:${ws.id}`,
        ...(alreadyActive
          ? {}
          : { actions: [{ label: t('workbench.workspace.grant.open'), run: () => onSwitchWorkspace(ws.id) }] }),
      });
    }
  }, [hydrated, consumedKey, activeWorkspaceId, notification, onSwitchWorkspace, t]);

  // An Org that grants forgets its dismissal, so a later revoke-to-zero
  // is not silent.
  useEffect(() => {
    if (!hydrated) return;
    const granted = new Set(consumed.map((ws) => ws.orgId));
    setDismissed((current) => {
      const next = new Set([...current].filter((orgId) => !granted.has(orgId)));
      if (next.size === current.size) return current;
      writeDismissedBanners(next);
      return next;
    });
  }, [hydrated, consumedKey]);

  if (!hydrated) return null;
  const zeroGrantOrgs = [...bindings.keys()].filter(
    (orgId) => !dismissed.has(orgId) && !consumed.some((ws) => ws.orgId === orgId),
  );
  if (zeroGrantOrgs.length === 0) return null;

  const orgName = (orgId: string): string =>
    snapshot.orgs.get(orgId)?.name ?? t('workbench.workspace.grant.orgFallback');
  const orgNames = zeroGrantOrgs.map(orgName).join(', ');
  // The server's page, one button per Org that has one; the web tab,
  // being that page already, offers none.
  const servers = zeroGrantOrgs
    .map((orgId) => ({ orgId, url: serverPageForOrg(orgId) }))
    .filter((entry): entry is { orgId: string; url: string } => entry.url !== null);
  const dismiss = (): void => {
    const next = new Set([...dismissed, ...zeroGrantOrgs]);
    writeDismissedBanners(next);
    setDismissed(next);
  };
  return (
    <Alert
      banner
      type="info"
      showIcon
      closable
      onClose={dismiss}
      data-testid="org-zero-grant-notice"
      title={t('workbench.workspace.grant.zeroBanner', { orgs: orgNames })}
      action={
        servers.length === 0 ? undefined : (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            {servers.map(({ orgId, url }) => (
              <Button
                key={orgId}
                size="small"
                data-testid={`org-zero-grant-open-${orgId}`}
                onClick={() => openServerPage(url)}
              >
                {t('workbench.workspace.grant.openServer', { org: orgName(orgId) })}
              </Button>
            ))}
          </span>
        )
      }
    />
  );
};

export default OrgWorkspaceAccessNotice;
