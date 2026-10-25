/**
 * Every theme variant pins the dirty tone its unsaved dots wear — the
 * salmon the marks were born with, which must light against a dark
 * variant's near-black card — and the save accent its commit buttons
 * set a white label on.
 */

import { DARK_VARIANT_IDS, getDarkVariant, getLightVariant, LIGHT_VARIANT_IDS } from '@openheaders/ui/themes';
import { describe, expect, it } from 'vitest';

function channel(hex: string, at: number): number {
  const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** The WCAG contrast ratio between two `#rrggbb` colors. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The contrast ratio of white text on a `#rrggbb` fill. */
function contrastUnderWhite(hex: string): number {
  return contrast('#ffffff', hex);
}

describe('theme variants — the dirty tone', () => {
  it('every variant pins a hex color', () => {
    for (const id of LIGHT_VARIANT_IDS) expect(getLightVariant(id).dirtyTone).toMatch(/^#[0-9a-f]{6}$/);
    for (const id of DARK_VARIANT_IDS) expect(getDarkVariant(id).dirtyTone).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a dark variant lights the tone against its near-black card (4.5:1)', () => {
    for (const id of DARK_VARIANT_IDS)
      expect(contrast(getDarkVariant(id).dirtyTone, '#141414'), id).toBeGreaterThanOrEqual(4.5);
  });

  it('every variant keeps the salmon the marks were born with', () => {
    for (const id of LIGHT_VARIANT_IDS) expect(getLightVariant(id).dirtyTone).toBe('#ff7875');
    for (const id of DARK_VARIANT_IDS) expect(getDarkVariant(id).dirtyTone).toBe('#ff7875');
  });
});

describe('theme variants — the unresolved tone', () => {
  it('every variant pins the strong red, apart from the salmon and visible on the dark card (3:1)', () => {
    for (const id of LIGHT_VARIANT_IDS) expect(getLightVariant(id).unresolvedTone).toBe('#f5222d');
    for (const id of DARK_VARIANT_IDS) {
      const v = getDarkVariant(id);
      expect(v.unresolvedTone, id).toBe('#f5222d');
      expect(contrast(v.unresolvedTone, '#141414'), id).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('theme variants — the save accent', () => {
  it('every variant pins a hex color', () => {
    for (const id of LIGHT_VARIANT_IDS) expect(getLightVariant(id).saveAccent).toMatch(/^#[0-9a-f]{6}$/);
    for (const id of DARK_VARIANT_IDS) expect(getDarkVariant(id).saveAccent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a dark variant carries the white label at the readable ratio (4.5:1)', () => {
    for (const id of DARK_VARIANT_IDS) {
      expect(contrastUnderWhite(getDarkVariant(id).saveAccent), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the light variants keep the brand orange', () => {
    for (const id of LIGHT_VARIANT_IDS) expect(getLightVariant(id).saveAccent).toBe('#f5722d');
  });
});
