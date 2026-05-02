import { describe, expect, it } from 'vitest';
import { isLiveVariableDraft, isLiveVariableEffective } from '../../src/live/variable-state';
import type { LiveVariable } from '../../src/types/v5/live';

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
