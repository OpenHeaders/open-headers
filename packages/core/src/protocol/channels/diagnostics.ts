/**
 * Diagnostic-bundle RPCs (the error reports plan §4.5). The document
 * composes the bundle; the host that owns the long-lived process
 * answers the one thing a document cannot read — the system facts.
 * Local IPC only (renderer ↔ main, document ↔ service worker); nothing
 * here leaves the device.
 */

import type { DiagnosticsFacts } from '../../diagnostics/facts';

export interface DiagnosticsRpc {
  /** The host's system facts for a bundle. Hard-off surfaces (a served web tab) leave it unanswered. */
  diagnosticsFacts: { req: Record<string, never>; res: { facts: DiagnosticsFacts } };
}
