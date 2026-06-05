/**
 * `inspection.cdpEnabled` master-switch schema registration.
 *
 * Pins the locked shape: a global, user-scope boolean defaulting OFF,
 * gated on the `cdpInspection` host capability so Firefox / Safari render
 * it disabled. Imports the real schema module (no inline re-declaration)
 * so a drift in the registration is caught here.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import { getDef } from '@openheaders/ui/workbench/settings/registry';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

describe('inspection.cdpEnabled schema', () => {
  it('registers the master switch with the locked shape', () => {
    const def = getDef('inspection.cdpEnabled');
    expect(def).toBeDefined();
    expect(def?.type).toBe('boolean');
    expect(def?.default).toBe(false);
    expect(def?.scope).toBe('user');
    expect(def?.category).toBe('inspection');
    expect(def?.requiresCapability).toBe('cdpInspection');
    expect(def?.capabilityUnavailableHint).toBeTruthy();
  });

  it('validates booleans through its valibot schema', () => {
    const def = getDef('inspection.cdpEnabled');
    if (!def) throw new Error('inspection.cdpEnabled not registered');
    expect(v.safeParse(def.schema, true).success).toBe(true);
    expect(v.safeParse(def.schema, false).success).toBe(true);
    expect(v.safeParse(def.schema, 'on').success).toBe(false);
  });
});
