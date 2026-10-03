/**
 * The page-side readers learn a secret-manager row's standing: the
 * probes of the rows' connections fold into the failures a renderer
 * resolver installs, so the Scope panel and the rule banner name the
 * typed reason the compile would — the desktop app away, the manager
 * absent — instead of reading an existing row as a missing one, while
 * a declined or locked manager keeps deferring (a send re-prompts).
 */

import type { SecretProviderProbe } from '@openheaders/core/secret-providers';
import type { HeaderRule, Vault, VaultSecret } from '@openheaders/core/types';
import { EMPTY_SECRET_MANAGER_FAILURES } from '@openheaders/core/variables';
import { secretManagerFailuresFromProbes } from '@openheaders/ui/shared/secret-manager-references';
import { buildScopeResolver } from '@openheaders/ui/workbench/components/panels/variables-panel/scope-resolver';
import { buildInContextVariables } from '@openheaders/ui/workbench/components/panels/variables-panel/scope-variables';
import { describe, expect, it } from 'vitest';

function smEntry(name: string, connectionId: string): VaultSecret {
  return {
    uid: `sec-${name}`,
    kind: 'secret-manager',
    name,
    locator: { provider: 'onepassword', connectionId, vault: 'Demo', item: 'api.openheaders.io', field: 'token' },
  };
}

const VAULT: Vault = {
  schemaVersion: 5,
  secrets: [smEntry('opToken', 'conn0001'), smEntry('opOther', 'conn0002'), smEntry('opLoose', '')],
};

function probes(entries: Array<[string, SecretProviderProbe]>): ReadonlyMap<string, SecretProviderProbe> {
  return new Map(entries);
}

describe('secretManagerFailuresFromProbes', () => {
  it('names the desktop app away and an absent manager, and nothing for an available or still-probing one', () => {
    const failures = secretManagerFailuresFromProbes(
      VAULT,
      probes([
        ['conn0001', { available: false, reason: 'broker-unreachable' }],
        ['conn0002', { available: false, reason: 'not-installed' }],
      ]),
    );
    expect(failures.get('opToken')).toBe('broker-unreachable');
    expect(failures.get('opOther')).toBe('unavailable');
    expect(failures.get('opLoose')).toBe('unavailable');
    expect(
      secretManagerFailuresFromProbes(
        { schemaVersion: 5, secrets: [smEntry('opToken', 'conn0001')] },
        probes([['conn0001', { available: true, verifiedAt: 1 }]]),
      ),
    ).toBe(EMPTY_SECRET_MANAGER_FAILURES);
    expect(
      secretManagerFailuresFromProbes({ schemaVersion: 5, secrets: [smEntry('opToken', 'conn0001')] }, probes([])),
    ).toBe(EMPTY_SECRET_MANAGER_FAILURES);
  });

  it('keeps deferring for a declined or locked manager — a send is the attempt', () => {
    for (const reason of ['denied', 'locked'] as const) {
      expect(
        secretManagerFailuresFromProbes(
          { schemaVersion: 5, secrets: [smEntry('opToken', 'conn0001')] },
          probes([['conn0001', { available: false, reason }]]),
        ),
      ).toBe(EMPTY_SECRET_MANAGER_FAILURES);
    }
  });
});

describe('the Scope panel over the standing', () => {
  const rule: HeaderRule = {
    schemaVersion: 5,
    uid: 'rule0001',
    path: 'rules/rule0001',
    name: 'Bearer',
    type: 'header',
    enabled: true,
    published: true,
    conditions: [{ uid: 'c1', type: 'request-domains', values: ['httpbin.org'] }],
    action: {
      requestHeaders: [
        { uid: 'h1', operation: 'override', headerName: 'Authorization', value: 'Bearer {{vault.opToken}}' },
      ],
      responseHeaders: [],
    },
  };

  function resolverWith(failures: ReturnType<typeof secretManagerFailuresFromProbes>) {
    return buildScopeResolver({
      vault: VAULT,
      environments: [],
      activeEnvironmentId: null,
      defaultEnvironmentId: null,
      workspaceVariables: { schemaVersion: 5, variables: [] },
      families: { ruleCollections: [], requestCollections: [], templateCollections: [] },
      liveRegistry: new Map(),
      secretManagerFailures: failures,
    });
  }

  it('reads a referenced row as its reference while the connection answers, never as a missing one', () => {
    const { inContextVars, inContextErrors } = buildInContextVariables({
      contextEntity: rule,
      activeCollectionId: null,
      resolver: resolverWith(EMPTY_SECRET_MANAGER_FAILURES),
      liveVariables: [],
      vault: VAULT,
    });
    expect(inContextErrors).toEqual([]);
    expect(inContextVars).toHaveLength(1);
    expect(inContextVars[0]).toMatchObject({
      resolved: true,
      scope: 'vault',
      isSensitive: false,
      value: 'op://Demo/api.openheaders.io/token',
    });
  });

  it('names the typed reason once the standing says the row cannot resolve here', () => {
    const failures = secretManagerFailuresFromProbes(
      VAULT,
      probes([['conn0001', { available: false, reason: 'broker-unreachable' }]]),
    );
    const { inContextVars, inContextErrors } = buildInContextVariables({
      contextEntity: rule,
      activeCollectionId: null,
      resolver: resolverWith(failures),
      liveVariables: [],
      vault: VAULT,
    });
    expect(inContextVars[0]?.resolved).toBe(false);
    expect(inContextErrors).toHaveLength(1);
    expect(inContextErrors[0]).toMatchObject({ reference: 'vault.opToken', reason: 'secret-broker-unreachable' });
  });
});
