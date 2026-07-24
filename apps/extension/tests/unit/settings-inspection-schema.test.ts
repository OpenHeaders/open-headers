/**
 * `inspection.cdpEnabled` master-switch schema registration.
 *
 * Pins the locked shape: a global, user-scope boolean defaulting OFF
 * (attaching the debugging protocol is an explicit user choice), gated on
 * the `cdpInspection` host capability so Firefox / Safari render it
 * disabled. Imports the real schema module (no inline re-declaration)
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
    expect(def?.default).toBe(false);
    expect(def?.scope).toBe('user');
    expect(def?.category).toBe('inspection');
    expect(def?.requiresCapability).toBe('cdpInspection');
    expect(def?.capabilityUnavailableHintKey).toBeTruthy();
  });

  it('defaults OFF regardless of the debugging-protocol capability', () => {
    const def = getDef('inspection.cdpEnabled');
    if (!def) throw new Error('inspection.cdpEnabled not registered');

    // No host-aware override: the attach is opt-in everywhere.
    expect(def.getDefault).toBeUndefined();

    // Capability present or absent, the registered default stays OFF.
    registerCapability('cdpInspection', () => true);
    expect(def.default).toBe(false);
  });

  it('validates booleans through its valibot schema', () => {
    const def = getDef('inspection.cdpEnabled');
    if (!def) throw new Error('inspection.cdpEnabled not registered');
    expect(v.safeParse(def.schema, true).success).toBe(true);
    expect(v.safeParse(def.schema, false).success).toBe(true);
    expect(v.safeParse(def.schema, 'on').success).toBe(false);
  });
});
