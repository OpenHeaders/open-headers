/**
 * Cross-app reveal — front the tray-resident window and route a
 * companion target into the renderer, on behalf of a surface that is
 * NOT this app (the browser extension's `companionReveal` peer RPC).
 *
 * Fronting from another app is harder than the tray/menu paths that
 * already call `showMainWindow()` while this app is active: macOS
 * needs an explicit activation with focus-steal (the user's gesture
 * happened in the browser, so the OS sees an unprovoked background
 * app), and Windows needs the native foreground helper to re-arm the
 * `SetForegroundWindow` grant the same way the post-install launch
 * does. The tool-window leg rides the existing `revealToolWindow`
 * broadcast; the renderer owns the target → dock/settings mapping.
 */

import type { CompanionRevealTarget } from '@openheaders/core/protocol';
import { app } from 'electron';
import { broadcastToAllRenderers } from './renderer-broadcast';
import { showMainWindow } from './window-manager';
import { forceForegroundWindow } from './windows-foreground';

export function revealAppSurface(target: CompanionRevealTarget): void {
  showMainWindow();
  if (process.platform === 'darwin') app.focus({ steal: true });
  if (process.platform === 'win32') forceForegroundWindow(process.pid);
  if (target !== 'workbench') broadcastToAllRenderers('revealToolWindow', { target });
}
