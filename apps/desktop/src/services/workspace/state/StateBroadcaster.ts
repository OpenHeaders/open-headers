/**
 * StateBroadcaster — functions for pushing state to external services and renderer.
 *
 * Centralizes all outbound communication: WebSocket clients and renderer windows via IPC.
 */

import electron from 'electron';
import type { WebSocketServiceLike, WorkspaceState } from './types';

/**
 * Push current rules to WebSocket service (for browser extensions).
 */
export function broadcastToServices(
  state: WorkspaceState,
  webSocketService: WebSocketServiceLike | null,
): void {
  if (webSocketService) {
    webSocketService.rules = state.rules;
    webSocketService.ruleHandler.broadcastRules();
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
