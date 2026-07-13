/**
 * Stream-grid scroll math — the sticky-header-aware reveal target behind
 * keyboard nav across unmounted rows. The window computation itself is
 * the console hook's (use-console-row-window.test.ts pins it); this pins
 * only the streams-specific offset math. DOM-level behavior (jsdom's
 * zero viewport renders the full list) stays covered by the two view
 * suites.
 */

import {
  STREAM_HEADER_PX,
  STREAM_ROW_PX,
  streamScrollTarget,
} from '@openheaders/ui/panel/components/detail/streams/use-stream-row-window';
import { describe, expect, it } from 'vitest';

const VIEWPORT = 400;

describe('streamScrollTarget', () => {
  it('returns null for a row already fully in view below the sticky header', () => {
    // Row 5 at scrollTop 0: top = header + 5·row, well inside the viewport.
    expect(streamScrollTarget(5, 0, VIEWPORT)).toBeNull();
  });

  it('row 0 at the top of an unscrolled list needs no scroll', () => {
    expect(streamScrollTarget(0, 0, VIEWPORT)).toBeNull();
  });

  it('a row above the fold scrolls so it sits flush under the sticky header', () => {
    const scrollTop = 50 * STREAM_ROW_PX;
    const target = streamScrollTarget(10, scrollTop, VIEWPORT);
    expect(target).toBe(10 * STREAM_ROW_PX);
    // At that scrollTop the row's content-space top (header + 10·row) sits
    // exactly one header band below — i.e. flush under the sticky band.
    expect(STREAM_HEADER_PX + 10 * STREAM_ROW_PX - (target as number)).toBe(STREAM_HEADER_PX);
  });

  it('a row hidden UNDER the sticky band (inside the scroll box but above the visible fold) still reveals', () => {
    // Row 50's content-space top = header + 50·row; at scrollTop equal to
    // that, the sticky band covers it. The target backs off by one band.
    const scrollTop = STREAM_HEADER_PX + 50 * STREAM_ROW_PX;
    expect(streamScrollTarget(50, scrollTop, VIEWPORT)).toBe(50 * STREAM_ROW_PX);
  });

  it('a row below the fold scrolls so its bottom edge meets the viewport bottom', () => {
    const target = streamScrollTarget(100, 0, VIEWPORT);
    expect(target).toBe(STREAM_HEADER_PX + 101 * STREAM_ROW_PX - VIEWPORT);
    // Sanity: at the target, the row bottom is exactly at the fold.
    expect(STREAM_HEADER_PX + 101 * STREAM_ROW_PX - (target as number)).toBe(VIEWPORT);
  });

  it('the boundary rows of a parked viewport need no scroll', () => {
    // Parked so rows [k, k+n) are visible below the header.
    const scrollTop = 30 * STREAM_ROW_PX;
    // First fully visible row: 30 (its content top = header + 30·row =
    // scrollTop + header, flush under the band).
    expect(streamScrollTarget(30, scrollTop, VIEWPORT)).toBeNull();
    // Last fully visible row: bottom = header + (p+1)·row ≤ scrollTop + viewport.
    const last = Math.floor((scrollTop + VIEWPORT - STREAM_HEADER_PX) / STREAM_ROW_PX) - 1;
    expect(streamScrollTarget(last, scrollTop, VIEWPORT)).toBeNull();
    expect(streamScrollTarget(last + 1, scrollTop, VIEWPORT)).not.toBeNull();
    expect(streamScrollTarget(29, scrollTop, VIEWPORT)).not.toBeNull();
  });
});
