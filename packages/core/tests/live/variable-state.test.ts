import { describe, expect, it } from 'vitest';
import {
  isLiveVariableDraft,
  isLiveVariableEffective,
  liveVariablesToPublishOnRun,
} from '../../src/live/variable-state';
import type { LiveVariable } from '../../src/types/live';

function lv(overrides: Partial<LiveVariable> = {}): LiveVariable {
  return {
    schemaVersion: 5,
    uid: 'lvxxxxxx',
    path: 'live-variables/lv',
    name: 'token',
    workflowUid: 'wfxxxxxx',
    stepId: 'step1',
    captureName: 'cap',
    enabled: true,
    published: true,
    ...overrides,
  };
}

describe('isLiveVariableDraft', () => {
  it('returns false when published === true', () => {
    expect(isLiveVariableDraft(lv())).toBe(false);
  });

  it('returns true when published is false', () => {
    expect(isLiveVariableDraft(lv({ published: false }))).toBe(true);
  });

  it('returns true when published is undefined', () => {
    expect(isLiveVariableDraft(lv({ published: undefined }))).toBe(true);
  });
});

describe('isLiveVariableEffective', () => {
  it('returns true when published + enabled', () => {
    expect(isLiveVariableEffective(lv())).toBe(true);
  });

  it('returns false when published is false, even if enabled', () => {
    expect(isLiveVariableEffective(lv({ published: false }))).toBe(false);
  });

  it('returns false when published is undefined (draft), even if enabled', () => {
    expect(isLiveVariableEffective(lv({ published: undefined }))).toBe(false);
  });

  it('returns false when disabled, even if published', () => {
    expect(isLiveVariableEffective(lv({ enabled: false }))).toBe(false);
  });
});

describe('liveVariablesToPublishOnRun', () => {
  const captures = { step1: { cap: 'produced-value' } };

  it('publishes a draft binding whose capture produced a value', () => {
    const draft = lv({ uid: 'lvdraft00', published: false });
    expect(liveVariablesToPublishOnRun([draft], captures)).toEqual(['lvdraft00']);
  });

  it('leaves an already-published binding alone (idempotent)', () => {
    expect(liveVariablesToPublishOnRun([lv({ published: true })], captures)).toEqual([]);
  });

  it('skips a binding whose capture produced no value', () => {
    const draft = lv({ uid: 'lvnoval00', published: false, captureName: 'missing' });
    expect(liveVariablesToPublishOnRun([draft], captures)).toEqual([]);
  });

  it('skips a binding pointing at a step the run did not produce', () => {
    const draft = lv({ uid: 'lvnostep0', published: false, stepId: 'other' });
    expect(liveVariablesToPublishOnRun([draft], captures)).toEqual([]);
  });

  it('publishes regardless of the enabled switch (publish records production, not on/off)', () => {
    const draft = lv({ uid: 'lvdisable', published: false, enabled: false });
    expect(liveVariablesToPublishOnRun([draft], captures)).toEqual(['lvdisable']);
  });

  it('returns only the draft, value-producing subset across a mixed set', () => {
    const result = liveVariablesToPublishOnRun(
      [
        lv({ uid: 'lvgo00000', published: false }),
        lv({ uid: 'lvpub0000', published: true }),
        lv({ uid: 'lvmiss000', published: false, captureName: 'missing' }),
      ],
      captures,
    );
    expect(result).toEqual(['lvgo00000']);
  });
});
