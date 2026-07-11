/**
 * Web-tab sign-out — drop this tab's daemon session and return to the
 * login gate.
 *
 * Clears the origin-scoped access token and any consumed-org records,
 * then reloads so the boot flow re-gates from a clean slate (no token ⇒
 * `decideGate` shows the gate against the still-reachable daemon).
 *
 * App-scoped by design: the identity provider's session (if any) is
 * left untouched, so signing out of the workbench is not signing out of
 * the IdP — an SSO re-login can proceed without re-entering the
 * password, matching how session-scoped web apps behave.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { hostStorage, OH } from '@openheaders/core/storage';
import { clearDaemonToken } from './daemon-token';

const SCOPE = 'SignOut';

export async function signOutWeb(navigate: () => void = () => window.location.assign('/')): Promise<void> {
  try {
    await clearDaemonToken();
    await hostStorage.remove(OH.joinedOrgs);
  } catch (err) {
    logger.warn(SCOPE, 'sign-out cleanup failed; returning to the gate anyway', err);
  }
  navigate();
}
