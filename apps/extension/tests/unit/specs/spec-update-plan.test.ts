/**
 * Spec → linked-collection update planner (the API-specs plan Phase F).
 * Pins:
 *   - requests pair by method + URL template: an in-sync collection
 *     plans empty; spec-only operations plan as adds, live-only as
 *     removes; a user rename stays matched and flags only `name`;
 *   - changed fields are named per request and the update partial
 *     reuses live header/param row uids by key so unchanged rows keep
 *     their sync identity;
 *   - spec-absent optionals carry no opinion: user descriptions and
 *     collection auth survive when the spec says nothing;
 *   - collection variables upsert by name — spec rows converge value
 *     on the live uid, user-added rows survive;
 *   - user duplicates of an operation the spec still names are never
 *     planned as removes.
 */

import { parseOpenApi } from '@openheaders/core/import';
import type { Collection, Request } from '@openheaders/core/types';
import { buildSpecUpdatePlan, specUpdatePlanSize } from '@openheaders/ui/workbench/components/specs/spec-update-plan';
import { describe, expect, it } from 'vitest';

function specYaml(opts: { extraOp?: boolean; statusParam?: boolean; dropUsers?: boolean; server?: string } = {}) {
  const lines = [
    "openapi: '3.1.0'",
    'info:',
    '  title: OpenHeaders API',
    "  version: '1.0.0'",
    'servers:',
    `  - url: ${opts.server ?? 'https://api.openheaders.io'}`,
    'paths:',
    '  /status:',
    '    get:',
    '      summary: Status',
  ];
  if (opts.statusParam) {
    lines.push(
      '      parameters:',
      '        - name: verbose',
      '          in: query',
      '          schema: { type: string }',
    );
  }
  lines.push('      responses:', "        '200':", '          description: OK');
  if (!opts.dropUsers) {
    lines.push(
      '  /users:',
      '    get:',
      '      summary: List users',
      '      responses:',
      "        '200':",
      '          description: OK',
    );
  }
  if (opts.extraOp) {
    lines.push(
      '  /users/{userId}:',
      '    get:',
      '      summary: Get user',
      '      parameters:',
      '        - name: userId',
      '          in: path',
      '          required: true',
      '          schema: { type: string }',
      '      responses:',
      "        '200':",
      '          description: OK',
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Live rows as the landing loop would have created them from v1. */
function liveFromParsed(content: string): { collection: Collection; requests: Request[] } {
  const parsed = parseOpenApi(content);
  const requests: Request[] = parsed.requests.map((r, i) => ({
    schemaVersion: 5,
    uid: `req0000${i + 1}`,
    path: `requests/openheaders-api-col00001/r${i + 1}`,
    name: r.request.name,
    ...(r.request.description !== undefined ? { description: r.request.description } : {}),
    method: r.request.method,
    url: r.request.url,
    headers: r.request.headers,
    params: r.request.params,
    auth: r.request.auth,
    body: r.request.body,
  }));
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'requests/openheaders-api-col00001',
    name: 'OpenHeaders API',
    variables: parsed.collectionVariables.map((v, i) => ({
      uid: `var0000${i + 1}`,
      name: v.name,
      value: v.value,
      type: v.type,
    })),
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...(parsed.collectionAuth !== undefined ? { auth: parsed.collectionAuth } : {}),
    specLink: { specUid: 'spc00001', sourceHash: 'sha256:v1' },
  };
  return { collection, requests };
}

describe('buildSpecUpdatePlan', () => {
  it('plans empty for an in-sync collection', () => {
    const live = liveFromParsed(specYaml());
    const plan = buildSpecUpdatePlan(parseOpenApi(specYaml()), live);
    expect(plan.adds).toEqual([]);
    expect(plan.changes).toEqual([]);
    expect(plan.removes).toEqual([]);
    expect(plan.variables).toBeNull();
    expect(plan.auth).toBeNull();
    expect(specUpdatePlanSize(plan)).toBe(0);
  });

  it('plans adds, removes, and per-field changes at operation granularity', () => {
    const live = liveFromParsed(specYaml());
    const plan = buildSpecUpdatePlan(
      parseOpenApi(specYaml({ extraOp: true, statusParam: true, dropUsers: true })),
      live,
    );
    expect(plan.adds).toHaveLength(1);
    expect(plan.adds[0]?.request.url).toContain('/users/{{userId}}');
    expect(plan.removes).toHaveLength(1);
    expect(plan.removes[0]?.name).toBe('List users');
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.changedFields).toEqual(['params']);
    expect(plan.changes[0]?.updates.params?.map((p) => p.key)).toEqual(['verbose']);
  });

  it('keeps a user rename matched and flags only the name', () => {
    const live = liveFromParsed(specYaml());
    const renamed = live.requests.map((r) => (r.name === 'Status' ? { ...r, name: 'Health check' } : r));
    const plan = buildSpecUpdatePlan(parseOpenApi(specYaml()), { ...live, requests: renamed });
    expect(plan.adds).toEqual([]);
    expect(plan.removes).toEqual([]);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.name).toBe('Health check');
    expect(plan.changes[0]?.changedFields).toEqual(['name']);
    expect(plan.changes[0]?.updates).toEqual({ name: 'Status' });
  });

  it('carries no opinion on user descriptions the spec never names', () => {
    const live = liveFromParsed(specYaml());
    const documented = live.requests.map((r) => ({ ...r, description: 'User-authored docs.' }));
    const plan = buildSpecUpdatePlan(parseOpenApi(specYaml()), { ...live, requests: documented });
    expect(plan.changes).toEqual([]);
  });

  it('reuses live param row uids by key so value edits keep identity', () => {
    const live = liveFromParsed(specYaml({ statusParam: true }));
    const statusRequest = live.requests.find((r) => r.url.endsWith('/status'));
    const liveParamUid = statusRequest?.params[0]?.uid;
    const edited = live.requests.map((r) =>
      r === statusRequest ? { ...r, params: r.params.map((p) => ({ ...p, value: 'true' })) } : r,
    );
    const plan = buildSpecUpdatePlan(parseOpenApi(specYaml({ statusParam: true })), { ...live, requests: edited });
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.changedFields).toEqual(['params']);
    expect(plan.changes[0]?.updates.params?.[0]?.uid).toBe(liveParamUid);
  });

  it('never plans user duplicates of a still-named operation as removes', () => {
    const live = liveFromParsed(specYaml());
    const original = live.requests[0];
    if (!original) throw new Error('fixture request missing');
    const withCopy = [...live.requests, { ...original, uid: 'req00099', name: `${original.name} (copy)` }];
    const plan = buildSpecUpdatePlan(parseOpenApi(specYaml()), { ...live, requests: withCopy });
    expect(plan.removes).toEqual([]);
  });

  it('upserts variables by name — live uid kept, user rows survive', () => {
    const live = liveFromParsed(specYaml());
    const userRow = { uid: 'var00099', name: 'apiKey', value: 'secret-123', type: 'secret' as const };
    const collection = { ...live.collection, variables: [...live.collection.variables, userRow] };
    const plan = buildSpecUpdatePlan(parseOpenApi(specYaml({ server: 'https://api2.openheaders.io' })), {
      collection,
      requests: live.requests,
    });
    expect(plan.variables).not.toBeNull();
    const baseUrl = plan.variables?.find((v) => v.name === 'baseUrl');
    expect(baseUrl?.value).toBe('https://api2.openheaders.io');
    expect(baseUrl?.uid).toBe(live.collection.variables[0]?.uid);
    expect(plan.variables?.find((v) => v.name === 'apiKey')).toEqual(userRow);
  });

  it('carries no opinion on collection auth when the spec declares none', () => {
    const live = liveFromParsed(specYaml());
    const collection = { ...live.collection, auth: { type: 'bearer' as const, token: 'user-token' } };
    const plan = buildSpecUpdatePlan(parseOpenApi(specYaml()), { collection, requests: live.requests });
    expect(plan.auth).toBeNull();
  });
});
