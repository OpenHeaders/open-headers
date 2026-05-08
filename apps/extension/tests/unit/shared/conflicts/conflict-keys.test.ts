import { describe, expect, it } from 'vitest';
import {
  decodeSetConflictKey,
  decodeSetValueConflictKey,
  reorderConflictKey,
  setConflictKey,
  setValueConflictKey,
} from '@/shared/conflicts/conflict-keys';

describe('conflict-keys codec', () => {
  it('round-trips uid-keyed set entries', () => {
    const k = setConflictKey('action.requestHeaders', 'abcd1234');
    expect(decodeSetConflictKey(k)).toEqual({ setPath: 'action.requestHeaders', uid: 'abcd1234' });
  });

  it('round-trips value-keyed entries containing reserved chars', () => {
    for (const value of ['simple', 'has.dot', 'has:colon', 'has%percent', '...', 'a.b:c%d', '']) {
      const k = setValueConflictKey('pinnedEnvironmentIds', value);
      const decoded = decodeSetValueConflictKey(k);
      expect(decoded).toEqual({ setPath: 'pinnedEnvironmentIds', value });
    }
  });

  it('reorder key passes through unchanged', () => {
    expect(reorderConflictKey('action.requestHeaders')).toBe('reorder:action.requestHeaders');
  });
});
