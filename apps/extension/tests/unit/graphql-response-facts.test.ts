/**
 * `graphqlResponseFacts` — what the meta strip's GraphQL tags read off
 * a snapshot: the errors[] list with path / location / code, the
 * data-null verdict, the pretty-printed extensions; null for anything
 * that is not a GraphQL response envelope (a binary or truncated body,
 * non-JSON, JSON without `data` / `errors`).
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { graphqlResponseFacts } from '@openheaders/ui/workbench/components/request-editor/response/graphql-response';
import { describe, expect, it } from 'vitest';

function snapshot(body: string, overrides: Partial<ExecutedRequestSnapshot> = {}): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/graphql',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: body.length,
    durationMs: 12,
    error: null,
    ...overrides,
  };
}

describe('graphqlResponseFacts', () => {
  it('reads a clean answer: no errors, data present, no extensions', () => {
    expect(graphqlResponseFacts(snapshot('{"data":{"echo":"hi"}}'))).toEqual({
      errors: [],
      dataNull: false,
      extensionsJson: null,
    });
  });

  it('reads the partial trap: errors beside data, with path / location / code', () => {
    const body = JSON.stringify({
      errors: [
        {
          message: 'The `broken` field always errors.',
          locations: [{ line: 1, column: 16 }],
          path: ['partial', 'broken'],
          extensions: { code: 'PROBE_PARTIAL' },
        },
      ],
      data: { partial: { ok: 'ok', broken: null } },
      extensions: { probe: { operation: null, fields: 3 } },
    });
    expect(graphqlResponseFacts(snapshot(body))).toEqual({
      errors: [
        {
          message: 'The `broken` field always errors.',
          path: 'partial.broken',
          location: '1:16',
          code: 'PROBE_PARTIAL',
        },
      ],
      dataNull: false,
      extensionsJson: JSON.stringify({ probe: { operation: null, fields: 3 } }, null, 2),
    });
  });

  it('reads a root bubble as data null, an error without path or location as bare', () => {
    const facts = graphqlResponseFacts(snapshot('{"errors":[{"message":"refused"}],"data":null}'));
    expect(facts).toEqual({
      errors: [{ message: 'refused', path: null, location: null, code: null }],
      dataNull: true,
      extensionsJson: null,
    });
  });

  it('reads a request error (no data key) as errors only', () => {
    const facts = graphqlResponseFacts(snapshot('{"errors":[{"message":"Syntax Error"}]}'));
    expect(facts?.errors.map((e) => e.message)).toEqual(['Syntax Error']);
    expect(facts?.dataNull).toBe(false);
  });

  it('is null for a non-envelope: plain JSON, non-JSON, binary or truncated bodies', () => {
    expect(graphqlResponseFacts(snapshot('{"users":[]}'))).toBeNull();
    expect(graphqlResponseFacts(snapshot('<html></html>'))).toBeNull();
    expect(graphqlResponseFacts(snapshot('e30=', { bodyEncoding: 'base64' }))).toBeNull();
    expect(graphqlResponseFacts(snapshot('{"data":{', { bodyTruncated: true }))).toBeNull();
  });
});
