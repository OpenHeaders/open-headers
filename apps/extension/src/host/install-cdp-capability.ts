/**
 * Debug mode (opt-in CDP path) capability registration.
 *
 * Side-effect module: importing it registers the `cdpInspection`
 * capability when — and only when — the runtime exposes the debugging
 * protocol (Chromium-family). Firefox / Safari leave `debugger`
 * undefined, so the capability stays absent and shared UI renders the
 * master-switch row disabled and reads it OFF.
 *
 * Every context that resolves the capability-gated `inspection.cdpEnabled`
 * setting must import this before settings init so the setting's
 * host-aware default lands correctly — that includes the service worker
 * (the effector behind the master switch), not just the UI surfaces.
 */

import { registerCapability } from '@openheaders/core/capabilities';
import { getBrowserAPI } from '@/types/browser';

if (getBrowserAPI().debugger !== undefined) {
  registerCapability('cdpInspection', () => true);
}
