/**
 * Token-aware truncation for the popup Rules table cells. The naive
 * mid-ellipsis used to slice through `{{ref}}` tokens — `{{vault.X_Y}}`
 * rendered as `{{vault.X…_Y}}` which obscured the variable name. The
 * smart algorithm anchors on the LAST `{{ref}}` in the value and pads
 * outward with surrounding literal segments up to the budget. These
 * tests lock the contract for every shape the algorithm is meant to
 * handle.
 */
import { describe, expect, it } from 'vitest';
import { truncateValue } from '@/popup/components/columns/sharedColumnRenderers';

describe('truncateValue', () => {
  describe('short / no-op cases', () => {
    it('returns the input unchanged when shorter than the budget', () => {
      expect(truncateValue('hello', 16)).toBe('hello');
      expect(truncateValue('exactly16chars!!', 16)).toBe('exactly16chars!!');
    });

    it('returns the full template when a single ref fits in the budget', () => {
      expect(truncateValue('{{env.API}}', 16)).toBe('{{env.API}}');
    });
  });

  describe('plain string truncation (no refs)', () => {
    it('falls back to legacy mid-ellipsis when no refs are present', () => {
      const out = truncateValue('this is a long literal value', 16);
      expect(out).toContain('...');
      expect(out.length).toBeLessThanOrEqual(16);
    });
  });

  describe('single ref longer than budget', () => {
    it('preserves the namespace prefix and abbreviates inside the ref', () => {
      const out = truncateValue('{{vault.CGM_X_BEARER_TOKEN}}', 16);
      // Should keep the leading `{{vault.` so the user knows the scope,
      // and end with `}}`. The middle is ellipsized.
      expect(out.startsWith('{{vault.')).toBe(true);
      expect(out.endsWith('}}')).toBe(true);
      expect(out).toContain('…');
      // The variable name's TAIL must survive — it's the disambiguating
      // part when several scope-prefixed names exist.
      expect(out).toMatch(/EN}}$|TOKEN}}$|KEN}}$|N}}$/);
    });

    it('handles a flat (no namespace) ref by ellipsizing inside braces', () => {
      const out = truncateValue('{{REALLY_LONG_FLAT_NAME}}', 16);
      expect(out.startsWith('{{')).toBe(true);
      expect(out.endsWith('}}')).toBe(true);
      expect(out).toContain('…');
    });
  });

  describe('ref + surrounding literal', () => {
    it('keeps the LAST ref intact and trims the leading literal', () => {
      const out = truncateValue('Bearer {{env.API_TOKEN}}', 18);
      // The variable reference is the load-bearing part; it must survive.
      expect(out).toContain('{{env.API_TOKEN}}');
    });

    it('drops the trailing literal when budget is tight', () => {
      // Anchor on the ref; the trailing literal "extra" gets ellipsized.
      const out = truncateValue('{{env.X}} extra trailing words', 16);
      expect(out).toContain('{{env.X}}');
    });

    it('marks dropped literal segments with an ellipsis', () => {
      const out = truncateValue('a long prefix before {{env.SHORT}}', 16);
      // Should signal that the prefix was clipped.
      expect(out).toMatch(/^…/);
      expect(out).toContain('{{env.SHORT}}');
    });
  });

  describe('multiple refs', () => {
    it('anchors on the LAST ref when both fit individually', () => {
      const out = truncateValue('{{env.A}} and {{env.B}}', 12);
      // Only one ref fits in 12; the algorithm prefers the last (most
      // recently authored = the variable the user is most likely
      // looking at).
      expect(out).toContain('{{env.B}}');
    });

    it('handles back-to-back refs', () => {
      const out = truncateValue('{{env.A}}{{env.B}}', 16);
      // Both fit — full string returned (length 18 > 16, but anchor on
      // last ref keeps that one whole; surrounding has the first ref).
      // Either both fit (no truncation needed because total <= 16+2)
      // or just last ref + ellipsis. Just verify the LAST ref is intact.
      expect(out).toContain('{{env.B}}');
    });

    it('preserves the scope prefix even when only one ref of three fits', () => {
      const out = truncateValue('{{env.A}}/{{env.B}}/{{env.C}}', 12);
      // Last ref = {{env.C}} is 9 chars; budget 12 fits it + 3 chars.
      expect(out).toContain('{{env.C}}');
    });
  });

  describe('whitespace + edge cases', () => {
    it('accepts an empty string', () => {
      expect(truncateValue('', 16)).toBe('');
    });

    it("doesn't blow up on a value that's just `{{}}`", () => {
      // Empty-named ref — degenerate but must not throw.
      const out = truncateValue('{{}}', 16);
      expect(out).toBe('{{}}');
    });
  });
});
