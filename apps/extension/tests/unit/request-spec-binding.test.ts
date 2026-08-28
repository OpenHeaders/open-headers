/**
 * HTTP request ↔ spec operation resolution (the Spec tab's pure half).
 * Pins:
 *   - a request pairs with its operation by method + URL template and
 *     reads in sync when every compared field matches;
 *   - a spec-side change names the field and carries the converging
 *     update; a user rename flags only `name`;
 *   - a method / URL the spec never names resolves to no operation.
 */

import { parseOpenApi } from '@openheaders/core/import';
import { resolveSpecOperation } from '@openheaders/ui/workbench/components/request-editor/request-spec-binding';
import { describe, expect, it } from 'vitest';

function specYaml(verbose = false): string {
  const lines = [
    "openapi: '3.1.0'",
    'info:',
    '  title: OpenHeaders API',
    "  version: '1.0.0'",
    'servers:',
    '  - url: https://api.openheaders.io',
    'paths:',
    '  /status:',
    '    get:',
    '      summary: Status',
  ];
  if (verbose) {
    lines.push(
      '      parameters:',
      '        - name: verbose',
      '          in: query',
      '          schema: { type: string }',
    );
  }
  lines.push('      responses:', "        '200':", '          description: OK');
  return `${lines.join('\n')}\n`;
}

describe('resolveSpecOperation', () => {
  it('pairs a request with its operation and reads in sync', () => {
    const parsed = parseOpenApi(specYaml());
    const spec = parsed.requests[0]?.request;
    if (!spec) throw new Error('fixture parsed no operation');
    const op = resolveSpecOperation(parsed, { ...spec, description: spec.description ?? '' });
    expect(op?.spec.name).toBe('Status');
    expect(op?.changedFields).toEqual([]);
  });

  it('names a spec-side param change and carries the update; a rename flags only name', () => {
    const parsed = parseOpenApi(specYaml(true));
    const stale = parseOpenApi(specYaml()).requests[0]?.request;
    if (!stale) throw new Error('fixture parsed no operation');
    const op = resolveSpecOperation(parsed, { ...stale, name: 'My status', description: stale.description ?? '' });
    expect(op?.changedFields).toEqual(['name', 'params']);
    expect(op?.updates.params?.map((p) => p.key)).toEqual(['verbose']);
  });

  it('resolves to no operation for a method + URL the spec never names', () => {
    const parsed = parseOpenApi(specYaml());
    const spec = parsed.requests[0]?.request;
    if (!spec) throw new Error('fixture parsed no operation');
    expect(resolveSpecOperation(parsed, { ...spec, method: 'DELETE' })).toBeNull();
  });
});
