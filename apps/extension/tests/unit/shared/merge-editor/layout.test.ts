import { describe, expect, it } from 'vitest';
import { gridTemplate, paneVisibility } from '@openheaders/ui/shared/merge-editor/components/layout';

const RATIOS = { cols: [1, 1, 1] as [number, number, number], rows: [0.35, 0.65] as [number, number] };

describe('gridTemplate', () => {
  it('column 3-pane: single row, 5px sashes between cols, no row sash', () => {
    const t = gridTemplate('column', true, true, RATIOS);
    expect(t.areas).toBe('"theirs sashTL result sashTR mine"');
    expect(t.cols).toBe('1fr 5px 1fr 5px 1fr');
    expect(t.rows).toBe('1fr');
    expect(t.rowSash).toBe(false);
  });

  it('column 2-pane fallback: theirs|result only, single col sash', () => {
    const t = gridTemplate('column', false, false, RATIOS);
    expect(t.areas).toBe('"theirs sashTL result"');
    expect(t.cols).toBe('1fr 5px 1fr');
    expect(t.rowSash).toBe(false);
  });

  it('show-base-top: base spans the whole top row, then row sash, then 3-pane row', () => {
    const t = gridTemplate('show-base-top', true, true, RATIOS);
    expect(t.areas).toContain('"base   base    base    base    base"');
    expect(t.areas).toContain('"theirs sashTL  result  sashTR  mine"');
    expect(t.cols).toBe('1fr 5px 1fr 5px 1fr');
    expect(t.rows).toBe('0.35fr 5px 0.65fr');
    expect(t.rowSash).toBe(true);
  });

  it('show-base-center: theirs|base|mine on top, row sash, result spans bottom', () => {
    const t = gridTemplate('show-base-center', true, true, RATIOS);
    expect(t.areas).toContain('"theirs sashTL  base    sashTR  mine"');
    expect(t.areas).toContain('"result result  result  result  result"');
    expect(t.cols).toBe('1fr 5px 1fr 5px 1fr');
    expect(t.rowSash).toBe(true);
  });

  it('show-base-top degrades to column when base unavailable', () => {
    const t = gridTemplate('show-base-top', true, false, RATIOS);
    expect(t.areas).toBe('"theirs sashTL result sashTR mine"');
    expect(t.rowSash).toBe(false);
  });

  it('show-base-center degrades to column when base unavailable', () => {
    const t = gridTemplate('show-base-center', true, false, RATIOS);
    expect(t.areas).toBe('"theirs sashTL result sashTR mine"');
    expect(t.rowSash).toBe(false);
  });

  it('show-base-top in 2-pane fallback degrades to 2-pane column', () => {
    // Edge case — base implies 3-pane shape, but the helper should be
    // robust if a caller flips has3Panes=false while baseAvailable=true.
    const t = gridTemplate('show-base-top', false, true, RATIOS);
    expect(t.areas).toBe('"theirs sashTL result"');
  });

  it('column reflects updated col fractions in the template string', () => {
    const t = gridTemplate('column', true, true, { cols: [2, 1, 1], rows: [0.35, 0.65] });
    expect(t.cols).toBe('2fr 5px 1fr 5px 1fr');
  });

  it('show-base-top reflects updated row fractions', () => {
    const t = gridTemplate('show-base-top', true, true, { cols: [1, 1, 1], rows: [0.5, 0.5] });
    expect(t.rows).toBe('0.5fr 5px 0.5fr');
  });
});

describe('paneVisibility', () => {
  it('column 3-pane: theirs+result+mine visible, base hidden', () => {
    expect(paneVisibility('column', true, true)).toEqual({ theirs: true, result: true, mine: true, base: false });
  });

  it('column 2-pane: only theirs+result visible', () => {
    expect(paneVisibility('column', false, false)).toEqual({
      theirs: true,
      result: true,
      mine: false,
      base: false,
    });
  });

  it('show-base-top: base visible alongside theirs+result+mine', () => {
    expect(paneVisibility('show-base-top', true, true)).toEqual({
      theirs: true,
      result: true,
      mine: true,
      base: true,
    });
  });

  it('show-base-center: same set as show-base-top (base+all-three)', () => {
    expect(paneVisibility('show-base-center', true, true)).toEqual({
      theirs: true,
      result: true,
      mine: true,
      base: true,
    });
  });

  it('show-base-top degrades to column visibility when base unavailable', () => {
    expect(paneVisibility('show-base-top', true, false)).toEqual({
      theirs: true,
      result: true,
      mine: true,
      base: false,
    });
  });

  it('show-base-center degrades to column visibility when base unavailable', () => {
    expect(paneVisibility('show-base-center', true, false).base).toBe(false);
  });
});
