/**
 * Fault injection — the poison seam between the developer-diagnostics
 * commands and the containment boundaries (the crash-and-error-reports
 * plan §3, a slice-1 addendum).
 *
 * A unit — a tab, a tool window, the document root — is armed by its
 * key. The {@link FaultProbe} rendered as the first child inside that
 * unit's boundary throws a real render error while its unit is armed,
 * so the real path runs end to end: the boundary catch, the funnel
 * line, the fallback. The arm clears when the fallback commits (the
 * boundary owner's `onCrashed`), never during render: React retries a
 * thrown render once before committing to a boundary, so a clear during
 * render would turn the fault into a recovered error and no fallback.
 * The root's arm needs no clearing — its fallback reloads the document.
 *
 * Production bundles carry the store and the probe, inert: nothing arms
 * a unit unless a host installed the developer diagnostics.
 */

export type FaultUnit = { kind: 'tab'; id: string } | { kind: 'window'; id: string } | { kind: 'root' };

/** The one root unit — a stable reference for the root probe. */
export const ROOT_FAULT_UNIT: FaultUnit = { kind: 'root' };

/** The error every injected failure throws, named so a log line reads as deliberate. */
export class InjectedFaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InjectedFaultError';
  }
}

export function faultUnitKey(unit: FaultUnit): string {
  return unit.kind === 'root' ? 'root' : `${unit.kind}:${unit.id}`;
}

const armed = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Arm a unit: its probe throws on its next render. */
export function armFault(unit: FaultUnit): void {
  const key = faultUnitKey(unit);
  if (armed.has(key)) return;
  armed.add(key);
  notify();
}

/** Clear a unit's arm — the fallback committed, the fault is spent. */
export function settleFault(unit: FaultUnit): void {
  if (!armed.delete(faultUnitKey(unit))) return;
  notify();
}

export function isFaultArmed(unit: FaultUnit): boolean {
  return armed.has(faultUnitKey(unit));
}

export function subscribeFaults(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Clear every arm (tests). */
export function resetFaults(): void {
  if (armed.size === 0) return;
  armed.clear();
  notify();
}
