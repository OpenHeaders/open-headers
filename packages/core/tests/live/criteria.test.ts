/**
 * Criteria (the workflow runs plan, The model): an extractor plus a
 * comparison, held against a response or a session message, and the one
 * sentence each gives when it does not hold.
 */

import { describe, expect, it } from 'vitest';
import { criteriaHoldTemplate, judgeCriteria, resolveCriteria } from '../../src/live/criteria';
import type { ExtractorSubject } from '../../src/live/extractor';
import { subjectOfMessage } from '../../src/live/session-port';
import type { Criterion } from '../../src/types/live';

const RESPONSE: ExtractorSubject = {
  status: 200,
  headers: [{ key: 'ETag', value: 'W/"7"' }],
  body: '{"name":"dev-1","state":"rebooting"}',
};

const MESSAGE = subjectOfMessage({
  position: 0,
  at: 1_000,
  address: 'devices/dev-1/status',
  body: '{"state":"rebooting"}',
  fields: [{ key: 'topic', value: 'devices/dev-1/status' }],
  stored: false,
});

const STATE: Criterion = {
  kind: 'equals',
  uid: 'crtstate',
  extractor: { kind: 'json-path', path: '$.state' },
  value: 'rebooting',
};

function reasonOf(criterion: Criterion, subject: ExtractorSubject = RESPONSE): string | null {
  const verdict = judgeCriteria([criterion], subject);
  return verdict.ok ? null : verdict.reason;
}

describe('judging', () => {
  it('holds when every criterion holds, and with none', () => {
    const etag: Criterion = { kind: 'exists', uid: 'crtetag0', extractor: { kind: 'header', name: 'etag' } };
    expect(judgeCriteria([STATE, etag, { kind: 'status', uid: 'crtstat0', match: '2xx' }], RESPONSE)).toEqual({
      ok: true,
    });
    expect(judgeCriteria([], RESPONSE)).toEqual({ ok: true });
  });

  it('gives the first criterion that does not hold as the reason', () => {
    const verdict = judgeCriteria(
      [
        STATE,
        { ...STATE, uid: 'crtname0', extractor: { kind: 'json-path', path: '$.name' } },
        { ...STATE, value: 'x' },
      ],
      RESPONSE,
    );
    expect(verdict).toEqual({ ok: false, reason: 'Expected $.name to equal "rebooting"; got "dev-1".' });
  });

  it('says what a status was expected to be', () => {
    const status = (match: Extract<Criterion, { kind: 'status' }>['match']): string | null =>
      reasonOf({ kind: 'status', uid: 'crtstat0', match }, { ...RESPONSE, status: 404 });
    expect(status('2xx')).toBe('Expected status 2xx; got 404.');
    expect(status(['eq', 200])).toBe('Expected status 200; got 404.');
    expect(status(['ne', 404])).toBe('Expected status other than 404; got 404.');
    expect(status(['in', [200, 201]])).toBe('Expected status one of 200, 201; got 404.');
    expect(status(['in', [404, 410]])).toBeNull();
  });

  it('says what was read where a value was expected and none could be', () => {
    const since = { kind: 'json-path', path: '$.since' } as const;
    expect(reasonOf({ kind: 'exists', uid: 'crtsince', extractor: since })).toBe(
      'Expected $.since to exist: Path "$.since" resolved to undefined.',
    );
    expect(reasonOf({ ...STATE, extractor: since })).toBe(
      'Expected $.since to equal "rebooting": Path "$.since" resolved to undefined.',
    );
  });

  it('holds a value to a pattern taken as written', () => {
    const header = { kind: 'header', name: 'etag' } as const;
    const body = { kind: 'whole-body' } as const;
    expect(reasonOf({ kind: 'matches', uid: 'crtweak0', extractor: header, pattern: '^W/' })).toBeNull();
    expect(reasonOf({ kind: 'matches', uid: 'crtweak1', extractor: header, pattern: '^"' })).toBe(
      'Expected header "etag" to match /^"/; got "W/"7"".',
    );
    expect(reasonOf({ kind: 'matches', uid: 'crtbrokn', extractor: body, pattern: '(' })).toBe(
      'Pattern /(/ does not compile.',
    );
  });

  it('cuts a long value it names', () => {
    const long = { ...RESPONSE, body: 'x'.repeat(500) };
    const reason = reasonOf({ ...STATE, extractor: { kind: 'whole-body' } }, long);
    expect(reason).toBe(`Expected the body to equal "rebooting"; got "${'x'.repeat(120)}…".`);
  });

  it('reads a session message as a response: its payload the body, its named fields the headers', () => {
    const topic: Criterion = {
      kind: 'equals',
      uid: 'crttopic',
      extractor: { kind: 'header', name: 'topic' },
      value: 'devices/dev-1/status',
    };
    expect(judgeCriteria([STATE, topic], MESSAGE)).toEqual({ ok: true });
  });

  it('finds no status on a session message', () => {
    expect(reasonOf({ kind: 'status', uid: 'crtstat0', match: '2xx' }, MESSAGE)).toBe(
      'A session message has no status.',
    );
    expect(reasonOf({ kind: 'exists', uid: 'crtcode0', extractor: { kind: 'status-code' } }, MESSAGE)).toBe(
      'Expected the status to exist: A session message has no status.',
    );
  });
});

describe('resolving', () => {
  it('resolves each equals value once and leaves a pattern as written', async () => {
    const pattern: Criterion = {
      kind: 'matches',
      uid: 'crtpatrn',
      extractor: { kind: 'whole-body' },
      pattern: '{{2}}',
    };
    const asked: string[] = [];
    const resolved = await resolveCriteria(
      [{ ...STATE, value: '{{step.reboot.state}}' }, pattern],
      async (template) => {
        asked.push(template);
        return 'rebooting';
      },
    );
    expect(asked).toEqual(['{{step.reboot.state}}']);
    expect(resolved).toEqual([STATE, pattern]);
  });

  it('says whether any value needs a host to resolve it', () => {
    expect(criteriaHoldTemplate([STATE])).toBe(false);
    expect(criteriaHoldTemplate([{ ...STATE, value: '{{env.state}}' }])).toBe(true);
  });
});
