/**
 * Every theme variant pins the dirty tone its unsaved marks wear. The
 * request editor's section count badge sets a white number on it, so
 * a dark variant's tone must carry white at the readable ratio — the
 * salmon the marks were born with reads at ~2.4:1 and stays on the
 * light variants only.
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

/** The contrast ratio of white text on a `#rrggbb` fill. */
function contrastUnderWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

describe('theme variants — the dirty tone', () => {
  it('every variant pins a hex color', () => {
    for (const id of LIGHT_VARIANT_IDS) expect(getLightVariant(id).dirtyTone).toMatch(/^#[0-9a-f]{6}$/);
    for (const id of DARK_VARIANT_IDS) expect(getDarkVariant(id).dirtyTone).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a dark variant carries a white number at the readable ratio (4.5:1)', () => {
    for (const id of DARK_VARIANT_IDS) {
      expect(contrastUnderWhite(getDarkVariant(id).dirtyTone), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the light variants keep the salmon the marks were born with', () => {
    for (const id of LIGHT_VARIANT_IDS) expect(getLightVariant(id).dirtyTone).toBe('#ff7875');
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
