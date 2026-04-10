/**
 * StateBroadcaster — functions for pushing state to external services and renderer.
 *
 * Centralizes all outbound communication: WebSocket clients and renderer windows via IPC.
 */

import type { V5 } from '@openheaders/core/types';
import electron from 'electron';
import type { WebSocketServiceLike, WorkspaceState } from './types';

/**
 * Push resolved rules to WebSocket service (for browser extensions).
 * The caller is responsible for resolving {{VAR}} templates before calling this.
 */
export function broadcastToServices(resolvedRules: V5.Rule[], webSocketService: WebSocketServiceLike | null): void {
  if (webSocketService) {
    webSocketService.updateRules(resolvedRules);
  }
}

/**
 * Send a state patch to all open renderer windows.
 * Safely no-ops when no windows exist (app running in background).
 */
export function sendPatchToRenderers(state: WorkspaceState, changedKeys: string[]): void {
  const patch: Record<string, unknown> = {};
  for (const key of changedKeys) {
    if (key in state) {
      patch[key] = state[key as keyof WorkspaceState];
    }
  }

  const { BrowserWindow } = electron;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('workspace:state-patch', patch);
    }
  }
}

/**
 * Send workspace switch progress to all renderer windows.
 */
export function sendProgressToRenderers(
  step: string,
  progress: number,
  label: string,
  isGitOperation = false,
  targetWorkspace?: { id: string; name: string; type: string },
): void {
  const { BrowserWindow } = electron;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('workspace:switch-progress', { step, progress, label, isGitOperation, targetWorkspace });
    }
  }
}
