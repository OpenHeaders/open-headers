import { formatConnectionInstant } from '@openheaders/ui/workbench/components/shared/ConnectionDetailsTooltip';
import { describe, expect, it } from 'vitest';

describe('formatConnectionInstant', () => {
  // A fixed local instant — the format reads the viewer's zone, so the
  // fixture is built from local components.
  const at = (day: number, hour = 9, minute = 42): number => new Date(2026, 7, day, hour, minute).getTime();

  it('reads the reference shape in English with the ordinal day', () => {
    expect(formatConnectionInstant('en', at(28))).toBe('Aug 28th 2026, 09:42');
    expect(formatConnectionInstant('en', at(1))).toBe('Aug 1st 2026, 09:42');
    expect(formatConnectionInstant('en', at(2))).toBe('Aug 2nd 2026, 09:42');
    expect(formatConnectionInstant('en', at(3))).toBe('Aug 3rd 2026, 09:42');
    expect(formatConnectionInstant('en', at(11))).toBe('Aug 11th 2026, 09:42');
    expect(formatConnectionInstant('en', at(22))).toBe('Aug 22nd 2026, 09:42');
  });

  it('leaves the ordinal habit to English', () => {
    const fr = formatConnectionInstant('fr', at(28));
    expect(fr).toContain('28');
    expect(fr).not.toContain('28th');
  });
});
