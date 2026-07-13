/**
 * `inspection.cdpEnabled` master-switch schema registration.
 *
 * Pins the locked shape: a global, user-scope boolean defaulting ON,
 * gated on the `cdpInspection` host capability so Firefox / Safari render
 * it disabled. Imports the real schema module (no inline re-declaration)
 * so a drift in the registration is caught here.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { getDef } from '@openheaders/ui/workbench/settings/registry';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';

describe('inspection.cdpEnabled schema', () => {
  afterEach(() => {
    unregisterCapability('cdpInspection');
  });

  it('registers the master switch with the locked shape', () => {
    const def = getDef('inspection.cdpEnabled');
    expect(def).toBeDefined();
    expect(def?.type).toBe('boolean');
    expect(def?.default).toBe(true);
    expect(def?.scope).toBe('user');
    expect(def?.category).toBe('inspection');
    expect(def?.requiresCapability).toBe('cdpInspection');
    expect(def?.capabilityUnavailableHintKey).toBeTruthy();
  });

  it('defaults ON only where the debugging protocol exists', () => {
    const def = getDef('inspection.cdpEnabled');
    if (!def) throw new Error('inspection.cdpEnabled not registered');

    // Firefox / Safari: capability absent → OFF.
    unregisterCapability('cdpInspection');
    expect(def.getDefault?.()).toBe(false);

    // Chromium-family: capability present → ON.
    registerCapability('cdpInspection', () => true);
    expect(def.getDefault?.()).toBe(true);
  });

  it('validates booleans through its valibot schema', () => {
    const def = getDef('inspection.cdpEnabled');
    if (!def) throw new Error('inspection.cdpEnabled not registered');
    expect(v.safeParse(def.schema, true).success).toBe(true);
    expect(v.safeParse(def.schema, false).success).toBe(true);
    expect(v.safeParse(def.schema, 'on').success).toBe(false);
  });
});
