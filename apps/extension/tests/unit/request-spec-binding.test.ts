/**
 * HTTP request ↔ spec operation resolution (the Spec tab's pure half).
 * Pins:
 *   - a request pairs with its operation by method + URL template and
 *     reads in sync when every compared field matches;
 *   - a spec-side change names the field and carries the converging
 *     update; a user rename flags only `name`;
 *   - a method / URL the spec never names resolves to no operation;
 *   - a draft still in the pre-epic `{{petId}}` form pairs with the
 *     `:petId` operation, and the apply lands the URL and the rows on
 *     the draft with the Path Parameters table re-derived from the
 *     resulting URL — rows applied without the URL keep nothing, the
 *     URL applied without the rows derives an empty row.
 */

import { parseOpenApi } from '@openheaders/core/import';
import { emptyDraft } from '@openheaders/ui/workbench/components/request-editor/draft';
import {
  applySpecOperation,
  resolveSpecOperation,
} from '@openheaders/ui/workbench/components/request-editor/request-spec-binding';
import { describe, expect, it } from 'vitest';

function specYaml(verbose = false, pet = false): string {
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
  if (pet) {
    lines.push(
      '  /pets/{petId}:',
      '    get:',
      '      summary: Get pet',
      '      parameters:',
      '        - name: petId',
      '          in: path',
      '          required: true',
      '          description: The pet id',
      "          example: '42'",
      '          schema: { type: string }',
      '      responses:',
      "        '200':",
      '          description: OK',
    );
  }
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

  describe('the path-parameter convergence', () => {
    const preEpicDraft = () => ({ ...emptyDraft(), url: '{{baseUrl}}/pets/{{petId}}' });
    const operationFor = (draft: ReturnType<typeof preEpicDraft>) =>
      resolveSpecOperation(parseOpenApi(specYaml(false, true)), {
        name: 'Get pet',
        description: draft.description,
        method: draft.method,
        url: draft.url,
        headers: [],
        params: [],
        pathParams: [],
        auth: draft.auth,
        body: draft.body,
      });

    it('pairs a {{petId}} draft with the :petId operation and names url + pathParams', () => {
      const op = operationFor(preEpicDraft());
      expect(op?.spec.name).toBe('Get pet');
      expect(op?.changedFields).toEqual(['url', 'pathParams']);
    });

    it('applying both lands the URL and the rows, the table derived from the new URL', () => {
      const draft = preEpicDraft();
      const op = operationFor(draft);
      if (!op) throw new Error('fixture paired no operation');
      const next = applySpecOperation(draft, op, ['url', 'pathParams']);
      expect(next.url).toBe('{{baseUrl}}/pets/:petId');
      expect(next.pathParams.map(({ key, value, description }) => ({ key, value, description }))).toEqual([
        { key: 'petId', value: '42', description: 'The pet id' },
      ]);
      expect(next.pathParams[0]?.uid).toBe(op.updates.pathParams?.[0]?.uid);
    });

    it('applying the rows alone keeps nothing while the URL is still {{petId}}; the URL alone derives an empty row', () => {
      const draft = preEpicDraft();
      const op = operationFor(draft);
      if (!op) throw new Error('fixture paired no operation');
      const rowsOnly = applySpecOperation(draft, op, ['pathParams']);
      expect(rowsOnly.url).toBe('{{baseUrl}}/pets/{{petId}}');
      expect(rowsOnly.pathParams).toEqual([]);
      const urlOnly = applySpecOperation(draft, op, ['url']);
      expect(urlOnly.url).toBe('{{baseUrl}}/pets/:petId');
      expect(urlOnly.pathParams.map(({ key, value }) => ({ key, value }))).toEqual([{ key: 'petId', value: '' }]);
    });
  });
});
