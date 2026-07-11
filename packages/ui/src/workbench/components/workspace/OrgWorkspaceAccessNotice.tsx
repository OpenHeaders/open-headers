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
 *     workspace list, nothing is cached).
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
import { Alert, App, Button } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useIdentitySnapshot } from '../../../shared/hooks/useIdentitySnapshot';

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
  const snapshot = useIdentitySnapshot();
  const bindings = getOrgBackendBindings();

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
      // Already on this workspace (a login adopted it) ⇒ acknowledge in
      // place with no "Open workspace" action, which would switch to the
      // workspace already open and so do nothing.
      const alreadyActive = ws.id === activeWorkspaceId;
      const toastKey = `org-workspace-arrival-${ws.id}`;
      notification.success({
        key: toastKey,
        message: alreadyActive ? `You now have access to "${ws.name}"` : `"${ws.name}" is now available`,
        description: (
          <span data-testid={`org-workspace-arrival-${ws.id}`}>
            {alreadyActive
              ? "An admin granted you access — you're working in it now."
              : 'An admin granted you access. Find it anytime in the workspace switcher.'}
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
            Open workspace
          </Button>
        ),
        duration: 8,
      });
      pushNotification({
        severity: 'success',
        title: alreadyActive ? `You now have access to "${ws.name}"` : `Workspace "${ws.name}" is now available`,
        description: alreadyActive
          ? "An admin granted you access — you're working in it now."
          : 'An admin granted you access — it appears in the workspace switcher.',
        dedupeKey: `org-workspace-arrived:${ws.id}`,
        ...(alreadyActive ? {} : { actions: [{ label: 'Open workspace', run: () => onSwitchWorkspace(ws.id) }] }),
      });
    }
  }, [hydrated, consumedKey, activeWorkspaceId, notification, onSwitchWorkspace]);

  if (!hydrated) return null;
  const zeroGrantOrgs = [...bindings.keys()].filter((orgId) => !consumed.some((ws) => ws.orgId === orgId));
  if (zeroGrantOrgs.length === 0) return null;

  const orgNames = zeroGrantOrgs.map((orgId) => snapshot.orgs.get(orgId)?.name ?? 'your organization').join(', ');
  return (
    <Alert
      banner
      type="info"
      showIcon
      data-testid="org-zero-grant-notice"
      message={
        `Connected to ${orgNames} — no workspaces granted to you yet. ` +
        "You're working in a local workspace; granted workspaces appear here automatically once an admin gives you access."
      }
    />
  );
};

export default OrgWorkspaceAccessNotice;
