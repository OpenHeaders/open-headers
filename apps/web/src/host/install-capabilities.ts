/**
 * Web host capability registrations. Shared `@openheaders/ui` code
 * reads through `@openheaders/core/capabilities` and never knows which
 * shell answered. Anything a plain tab can't do (CDP, surface
 * self-close, DNR nudges) simply isn't registered here, and shared
 * code branches off `hasCapability`.
 */

import { hostBridge } from '@openheaders/core/bridge';
import {
  registerCapability,
  type WorkspaceMembersApi,
  type WorkspaceMembersListResult,
  type WorkspaceMembersMutationResult,
  type WorkspacePublicShareApi,
  type WorkspacePublicShareMutationResult,
  type WorkspacePublicSharePreview,
  type WorkspacePublicShareStatus,
} from '@openheaders/core/capabilities';
import { showTransitionOverlay } from '@/transition-overlay';
import { isPublicView } from './public-view';
import { signOutWeb } from './sign-out';
import { callWireRpc, registerWireRpcChannels } from './wire-rpc';

registerCapability('getActiveWorkspaceId', () => hostBridge.call('getActiveWorkspaceId'));

// External links open a plain new tab; the browser owns session trust.
registerCapability('openExternalUrl', (url) => {
  window.open(url, '_blank', 'noopener');
  return Promise.resolve({ ok: true });
});

// The anonymous public viewer (F5b) is a session-less, wire-less
// read-only mount — everything below is a signed-tab affordance (a
// daemon session, wire verbs, remote dispatch) and stays unregistered
// there so shared UI hides it wholesale.
if (!isPublicView()) {
  // API requests execute on the connected daemon's Node fetch stack, not
  // in this tab — the request editor's Settings tab shows the Node fact
  // sheet and hides browser-only knobs.
  registerCapability('requestRuntime', () => 'node');

  // …and that stack is REMOTE: the serving host's machine makes the
  // egress connection, so the target sees ITS IP and network locale, not
  // this device's. Named by the origin the user typed to reach this tab —
  // the Send hint and the response's "Sent from" attribution read it.
  registerCapability('remoteRequestDispatch', () => window.location.host);

  // The web tab owns an origin-scoped daemon session it can drop on its
  // own — surfaced as the settings-menu "Sign out" item. The overlay
  // paints before the storage clear + reload so the click has instant
  // feedback and the tear-down never shows a frozen frame.
  registerCapability('signOut', () => {
    showTransitionOverlay('Signing out…');
    void signOutWeb();
  });

  // Give up the caller's own grant on a served workspace (QD). The verb
  // runs on the serving daemon as the authenticated peer; on success the
  // daemon's retraction push evicts the workspace from this tab (and the
  // user's other open tabs), so no local removal step follows the call.
  registerWireRpcChannels(['leaveWorkspace']);
  registerCapability('leaveWorkspace', async (workspaceId) => {
    const result = await callWireRpc({ type: 'leaveWorkspace', workspaceId });
    return (result ?? { ok: false }) as { ok: boolean; reason?: string; error?: string };
  });

  // Owner self-service member management (F4). Every verb runs on the
  // serving daemon as the authenticated peer — the daemon gates
  // mutations on the CALLER's owner role and answers refusals in-band;
  // a grant/revoke's live offer/retract push updates the member's open
  // tabs, so the modal only re-lists after a mutation.
  registerWireRpcChannels(['listWorkspaceMembers', 'grantWorkspaceMember', 'revokeWorkspaceMember']);
  const workspaceMembersApi: WorkspaceMembersApi = {
    async list(workspaceId) {
      const result = await callWireRpc({ type: 'listWorkspaceMembers', workspaceId });
      return (result ?? { ok: false }) as WorkspaceMembersListResult;
    },
    async grant(workspaceId, userId, role) {
      const result = await callWireRpc({ type: 'grantWorkspaceMember', workspaceId, userId, role });
      return (result ?? { ok: false }) as WorkspaceMembersMutationResult;
    },
    async revoke(workspaceId, userId) {
      const result = await callWireRpc({ type: 'revokeWorkspaceMember', workspaceId, userId });
      return (result ?? { ok: false }) as WorkspaceMembersMutationResult;
    },
  };
  registerCapability('workspaceMembers', () => workspaceMembersApi);

  // Owner public sharing (F5b). Same posture as the members plane: the
  // daemon owner-gates every verb; publish additionally rides the
  // server's publicWorkspaces switch, and the review preview is
  // computed server-side from the exact projection a publish stores.
  registerWireRpcChannels([
    'getWorkspacePublicShare',
    'previewWorkspacePublicShare',
    'publishWorkspacePublicShare',
    'unpublishWorkspacePublicShare',
  ]);
  const workspacePublicShareApi: WorkspacePublicShareApi = {
    async status(workspaceId) {
      const result = await callWireRpc({ type: 'getWorkspacePublicShare', workspaceId });
      return (result ?? { ok: false }) as WorkspacePublicShareStatus;
    },
    async preview(workspaceId) {
      const result = await callWireRpc({ type: 'previewWorkspacePublicShare', workspaceId });
      return (result ?? { ok: false }) as WorkspacePublicSharePreview;
    },
    async publish(workspaceId) {
      const result = await callWireRpc({ type: 'publishWorkspacePublicShare', workspaceId });
      return (result ?? { ok: false }) as WorkspacePublicShareMutationResult;
    },
    async unpublish(workspaceId) {
      const result = await callWireRpc({ type: 'unpublishWorkspacePublicShare', workspaceId });
      return (result ?? { ok: false }) as WorkspacePublicShareMutationResult;
    },
  };
  registerCapability('workspacePublicShare', () => workspacePublicShareApi);
}
