import { describe, expect, it } from 'vitest';
import { buildMessageFilter } from '../../src/utils/message-filter';

describe('buildMessageFilter', () => {
  it("maps 'none' (or anything non-filter) to no filter at all", () => {
    expect(buildMessageFilter('none', 'ignored')).toBeUndefined();
    expect(buildMessageFilter(undefined, 'ignored')).toBeUndefined();
    expect(buildMessageFilter('', '')).toBeUndefined();
  });

  it('projects a configured type + value onto the schema shape', () => {
    expect(buildMessageFilter('contains', 'order')).toEqual({ matchType: 'contains', value: 'order' });
    expect(buildMessageFilter('regex', '^ping$')).toEqual({ matchType: 'regex', value: '^ping$' });
  });

  it('KEEPS a configured filter with an empty value (draft lock, never a silent broaden)', () => {
    expect(buildMessageFilter('contains', undefined)).toEqual({ matchType: 'contains', value: '' });
    expect(buildMessageFilter('regex', '')).toEqual({ matchType: 'regex', value: '' });
  });
});
