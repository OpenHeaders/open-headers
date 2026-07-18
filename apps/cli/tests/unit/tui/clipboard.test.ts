/**
 * OSC 52 clipboard escape — base64 payload, BEL-terminated.
 */

import { describe, expect, it } from 'vitest';
import { osc52Copy } from '../../../src/tui/clipboard';

describe('clipboard', () => {
  it('encodes the yanked text as a c-selection OSC 52 write', () => {
    expect(osc52Copy('rule-uid-1')).toBe(`\x1b]52;c;${Buffer.from('rule-uid-1').toString('base64')}\x07`);
  });
});
