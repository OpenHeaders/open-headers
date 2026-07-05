import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { RuleDraftSchema } from '../../src/schemas/rule-draft';

describe('RuleDraftSchema — ws/sse variants', () => {
  it('accepts a minimal ws draft', () => {
    expect(v.parse(RuleDraftSchema, { type: 'ws' })).toBeTruthy();
  });

  it('accepts a seeded ws draft', () => {
    const draft = v.parse(RuleDraftSchema, {
      type: 'ws',
      name: 'Modify ping frames',
      url: 'wss://api.openheaders.io/live',
      operation: 'modify',
      direction: 'send',
      messageFilter: { matchType: 'contains', value: 'ping' },
      payload: '{"type":"pong"}',
    });
    expect(draft.type).toBe('ws');
  });

  it('accepts an inject ws draft with trigger', () => {
    expect(
      v.parse(RuleDraftSchema, { type: 'ws', operation: 'inject', direction: 'receive', injectTrigger: 'open' }),
    ).toBeTruthy();
  });

  it('rejects a ws draft with an unknown operation', () => {
    expect(v.safeParse(RuleDraftSchema, { type: 'ws', operation: 'replace' }).success).toBe(false);
  });

  it('rejects a ws draft with a malformed message filter', () => {
    expect(v.safeParse(RuleDraftSchema, { type: 'ws', messageFilter: { matchType: 'glob', value: 'x' } }).success).toBe(
      false,
    );
  });

  it('accepts a minimal sse draft', () => {
    expect(v.parse(RuleDraftSchema, { type: 'sse' })).toBeTruthy();
  });

  it('accepts a seeded sse draft with event name', () => {
    const draft = v.parse(RuleDraftSchema, {
      type: 'sse',
      url: 'https://api.openheaders.io/events',
      operation: 'modify',
      eventName: 'update',
      messageFilter: { matchType: 'regex', value: 'status.*ok' },
      payload: '{"status":"down"}',
    });
    expect(draft.type).toBe('sse');
  });

  it('strips fields the sse variant does not carry', () => {
    const draft = v.parse(RuleDraftSchema, { type: 'sse', direction: 'send' });
    expect('direction' in draft).toBe(false);
  });
});
