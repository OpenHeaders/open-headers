/**
 * Public-view mode detection (the access-foundation plan §8 F5b) —
 * the served SPA doubles as the anonymous read-only viewer when loaded
 * at `/public/<workspaceId>`. Import-time install modules and the
 * entry file branch on this, so it must stay dependency-light and
 * synchronous.
 */

import { parsePublicWorkspacePath } from '@openheaders/core/protocol';

/** The workspace id when this tab is the anonymous public viewer, else null. */
export function publicViewWorkspaceId(pathname: string = window.location.pathname): string | null {
  const parsed = parsePublicWorkspacePath(pathname);
  return parsed !== null && parsed.kind === 'page' ? parsed.workspaceId : null;
}

export function isPublicView(): boolean {
  return publicViewWorkspaceId() !== null;
}
