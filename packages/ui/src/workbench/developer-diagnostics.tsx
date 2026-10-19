/**
 * Developer diagnostics — the dev-only command set that reaches every
 * containment fallback by hand and from e2e (the crash-and-error-reports
 * plan §3, a slice-1 addendum): crash the active tab, crash a visible
 * tool window, crash the window (the root fallback), hang the renderer,
 * throw an uncaught error, reject a promise.
 *
 * Dev-only by construction: the palette section exists only after a
 * host entry called {@link installDeveloperDiagnostics}, and each host
 * does so from its platform's own fact — the desktop when Electron
 * reports the app unpackaged, the extension on a development install,
 * the web host under Vite's dev server. No build flag, no setting and
 * no string decides it; a packaged build has no caller.
 *
 * The labels are deliberately untranslated developer strings: nobody
 * but a developer ever sees them, so they carry no catalog keys. The
 * ids are the e2e contract ({@link DEVELOPER_COMMAND_IDS}) and stay
 * stable.
 */

import { BugOutlined } from '@ant-design/icons';
import { armFault, InjectedFaultError, ROOT_FAULT_UNIT } from '@openheaders/ui/shared/fault-injection';
import { useMemo, useSyncExternalStore } from 'react';
import type { CommandPaletteItem, CommandPaletteSection } from './components/shell/CommandPalette';
import type { ToolWindowId } from './types';

export const DEVELOPER_COMMAND_IDS = {
  section: 'developer',
  crashTab: 'dev-crash-tab',
  crashRoot: 'dev-crash-root',
  hangRenderer: 'dev-hang-renderer',
  throwUncaught: 'dev-throw-uncaught',
  rejectUnhandled: 'dev-reject-unhandled',
  crashToolWindow: (id: ToolWindowId): string => `dev-crash-window-${id}`,
} as const;

/**
 * Longer than Chromium's hung-renderer delay (30 s), so one click into
 * the frozen window raises the dialog before the loop ends. The hang
 * law: the monitor runs only while the window is visible — a window
 * covered by another never reports.
 */
export const DEVELOPER_HANG_MS = 40_000;

let installed = false;
const listeners = new Set<() => void>();

/** Turn the command set on. A host entry calls it from its own dev fact; nothing else does. */
export function installDeveloperDiagnostics(): void {
  if (installed) return;
  installed = true;
  for (const listener of listeners) listener();
}

export function isDeveloperDiagnosticsInstalled(): boolean {
  return installed;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Runs `run` after the next paint, so the palette closes before a blocking command freezes the document. */
function afterNextPaint(run: () => void): void {
  requestAnimationFrame(() => setTimeout(run, 0));
}

function hangRenderer(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    // Blocking the event loop is the point.
  }
}

export interface DeveloperCommandContext {
  activeTabId: string | null;
  /** The tool windows showing in a dock right now — one crash command each. */
  visibleToolWindows: readonly ToolWindowId[];
}

export function buildDeveloperCommandSection(context: DeveloperCommandContext): CommandPaletteSection {
  const { activeTabId, visibleToolWindows } = context;
  const icon = <BugOutlined />;
  const items: CommandPaletteItem[] = [];
  if (activeTabId !== null) {
    items.push({
      id: DEVELOPER_COMMAND_IDS.crashTab,
      icon,
      label: 'Crash this tab',
      scope: 'A render error inside the active tab; the tab fallback shows',
      onSelect: () => armFault({ kind: 'tab', id: activeTabId }),
    });
  }
  for (const id of visibleToolWindows) {
    items.push({
      id: DEVELOPER_COMMAND_IDS.crashToolWindow(id),
      icon,
      label: `Crash tool window: ${id}`,
      scope: 'A render error inside the tool window; its fallback shows',
      onSelect: () => armFault({ kind: 'window', id }),
    });
  }
  items.push(
    {
      id: DEVELOPER_COMMAND_IDS.crashRoot,
      icon,
      label: 'Crash the window',
      scope: 'A render error above every unit; the root fallback shows',
      onSelect: () => armFault(ROOT_FAULT_UNIT),
    },
    {
      id: DEVELOPER_COMMAND_IDS.hangRenderer,
      icon,
      label: `Hang the renderer for ${DEVELOPER_HANG_MS / 1000} s`,
      scope: 'Keep the window uncovered and click it once; a hidden window never raises the dialog',
      onSelect: () => afterNextPaint(() => hangRenderer(DEVELOPER_HANG_MS)),
    },
    {
      id: DEVELOPER_COMMAND_IDS.throwUncaught,
      icon,
      label: 'Throw an uncaught error',
      scope: "The document's error event; one funnel line, nothing on screen",
      onSelect: () =>
        setTimeout(() => {
          throw new InjectedFaultError('uncaught error injected');
        }, 0),
    },
    {
      id: DEVELOPER_COMMAND_IDS.rejectUnhandled,
      icon,
      label: 'Reject an unhandled promise',
      scope: "The document's unhandledrejection event; one funnel line, nothing on screen",
      onSelect: () => void Promise.reject(new InjectedFaultError('unhandled rejection injected')),
    },
  );
  return { id: DEVELOPER_COMMAND_IDS.section, title: 'Developer', items };
}

/** The palette section, or null until a host installed the diagnostics. */
export function useDeveloperCommandSection(context: DeveloperCommandContext): CommandPaletteSection | null {
  const on = useSyncExternalStore(subscribe, isDeveloperDiagnosticsInstalled);
  const { activeTabId, visibleToolWindows } = context;
  return useMemo(
    () => (on ? buildDeveloperCommandSection({ activeTabId, visibleToolWindows }) : null),
    [on, activeTabId, visibleToolWindows],
  );
}
