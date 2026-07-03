import { cookieHeaderRuleTouched, cookieRowIndicator } from '@openheaders/ui/panel/data/cookies/cookie-indicators';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

function fireWithMods(mods: Array<{ direction: 'request' | 'response'; headerName: string }>): InspectorFire {
  return {
    ruleUid: 'r1',
    t: 0,
    pattern: '*://openheaders.io/*',
    authoritative: false,
    evidence: 'matched',
    ruleSnapshot: {
      ruleUid: 'r1',
      name: 'Cookie rule',
      type: 'header',
      enabled: true,
      headerMods: mods.map((m) => ({
        direction: m.direction,
        operation: 'override' as const,
        headerName: m.headerName,
      })),
    },
  };
}

describe('cookieHeaderRuleTouched', () => {
  it('detects a request Cookie-header mod', () => {
    const fires = [fireWithMods([{ direction: 'request', headerName: 'Cookie' }])];
    expect(cookieHeaderRuleTouched(fires, 'request')).toBe(true);
    expect(cookieHeaderRuleTouched(fires, 'response')).toBe(false);
  });

  it('detects a response Set-Cookie mod case-insensitively', () => {
    const fires = [fireWithMods([{ direction: 'response', headerName: 'set-cookie' }])];
    expect(cookieHeaderRuleTouched(fires, 'response')).toBe(true);
    expect(cookieHeaderRuleTouched(fires, 'request')).toBe(false);
  });

  it('ignores non-cookie header mods and the wrong direction', () => {
    const fires = [
      fireWithMods([
        { direction: 'request', headerName: 'Authorization' },
        { direction: 'response', headerName: 'Cookie' },
      ]),
    ];
    expect(cookieHeaderRuleTouched(fires, 'request')).toBe(false);
    expect(cookieHeaderRuleTouched(fires, 'response')).toBe(false);
  });

  it('is false for fires without a rule snapshot or header mods', () => {
    const bare: InspectorFire = { ruleUid: 'r', t: 0, pattern: '*', authoritative: true, evidence: 'matched' };
    expect(cookieHeaderRuleTouched([bare], 'request')).toBe(false);
    expect(cookieHeaderRuleTouched([], 'request')).toBe(false);
  });
});

describe('cookieRowIndicator', () => {
  it('rule outranks edited', () => {
    expect(cookieRowIndicator(true, true)).toBe('rule');
    expect(cookieRowIndicator(false, true)).toBe('rule');
  });
  it('grey when only edited', () => {
    expect(cookieRowIndicator(true, false)).toBe('edited');
  });
  it('null when neither', () => {
    expect(cookieRowIndicator(false, false)).toBeNull();
  });
});
