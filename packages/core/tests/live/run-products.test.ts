import { describe, expect, it } from 'vitest';
import type { StepProduct } from '../../src/live/run-events';
import { createRunProductHold } from '../../src/live/run-products';

function response(body: string): StepProduct {
  return {
    kind: 'response',
    snapshot: {
      status: 200,
      statusText: 'OK',
      url: 'https://api.openheaders.io/',
      headers: [],
      body,
      bodyTruncated: false,
      bodyBytes: body.length,
      durationMs: 10,
      error: null,
    },
  };
}

describe('a hold of one run a workflow', () => {
  it('drops a workflow’s run when its next one begins, and keeps another workflow’s', () => {
    const hold = createRunProductHold(1_000);
    hold.open('wf-one', 'r1');
    hold.put('wf-one', 'r1', 'login', response('first'));
    hold.open('wf-two', 'r2');
    hold.put('wf-two', 'r2', 'login', response('other'));

    hold.open('wf-one', 'r3');

    expect(hold.get('r1', 'login')).toBeNull();
    expect(hold.get('r2', 'login')).toMatchObject({ snapshot: { body: 'other' } });
  });

  it('holds nothing for a run it no longer keeps, or under another workflow’s name', () => {
    const hold = createRunProductHold(1_000);
    hold.open('wf-one', 'r1');
    hold.open('wf-one', 'r2');

    hold.put('wf-one', 'r1', 'login', response('late'));
    hold.put('wf-two', 'r2', 'login', response('misnamed'));

    expect(hold.get('r1', 'login')).toBeNull();
    expect(hold.get('r2', 'login')).toBeNull();
  });
});

describe('a hold of several runs a workflow', () => {
  it('keeps a workflow’s earlier runs up to its count; past it the oldest goes', () => {
    const hold = createRunProductHold(1_000, 2);
    for (const runId of ['r1', 'r2', 'r3']) {
      hold.open('wf-one', runId);
      hold.put('wf-one', runId, 'login', response(runId));
    }

    expect(hold.get('r1', 'login')).toBeNull();
    expect(hold.get('r2', 'login')).toMatchObject({ snapshot: { body: 'r2' } });
    expect(hold.get('r3', 'login')).toMatchObject({ snapshot: { body: 'r3' } });
  });

  it('counts each workflow’s runs on their own', () => {
    const hold = createRunProductHold(1_000, 2);
    hold.open('wf-one', 'r1');
    hold.put('wf-one', 'r1', 'login', response('one'));
    hold.open('wf-two', 'r2');
    hold.open('wf-two', 'r3');
    hold.open('wf-two', 'r4');

    expect(hold.get('r1', 'login')).toMatchObject({ snapshot: { body: 'one' } });
  });

  it('an earlier run still going holds what it produces', () => {
    const hold = createRunProductHold(1_000, 2);
    hold.open('wf-one', 'r1');
    hold.open('wf-one', 'r2');

    hold.put('wf-one', 'r1', 'login', response('late'));

    expect(hold.get('r1', 'login')).toMatchObject({ snapshot: { body: 'late' } });
  });

  it('past the budget the oldest runs give theirs up first, never the run that is holding', () => {
    const hold = createRunProductHold(30, 3);
    hold.open('wf-one', 'r1');
    hold.put('wf-one', 'r1', 'login', response('x'.repeat(20)));
    hold.open('wf-one', 'r2');
    hold.put('wf-one', 'r2', 'login', response('y'.repeat(20)));
    hold.open('wf-one', 'r3');

    hold.put('wf-one', 'r3', 'login', response('z'.repeat(40)));

    expect(hold.get('r1', 'login')).toBeNull();
    expect(hold.get('r2', 'login')).toBeNull();
    expect(hold.get('r3', 'login')).toMatchObject({ snapshot: { body: 'z'.repeat(40) } });
  });
});
