/**
 * Status + Time cell rendering of the preserved-unknown "(unknown)" verdict.
 *
 * When a committed top-level navigation supersedes a page, its still-in-flight
 * requests never reach a terminal event. With Preserve-log on they stay in
 * view, and both the Status and Time cells read "(unknown)" (with the
 * page-unloaded tooltip) instead of "(pending)" / "Pending" forever — host
 * parity. A row that already had a status keeps it in the Status cell but still
 * reads "(unknown)" in the Time cell (it never finished); a current-page slow
 * request still reads pending in both.
 */

import { COLUMN_DEFS } from '@openheaders/ui/panel/components/traffic/columns';
import { type CellContext, renderCell } from '@openheaders/ui/panel/components/traffic/render-cell';
import { classifyRequestState } from '@openheaders/ui/panel/data/request-state';
import { getSizeInfo } from '@openheaders/ui/panel/data/size-info';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeRow, type RowOverrides } from '../../__factories__/lifecycle';

const NAV_AT = 1_000;

const CTX: CellContext = {
  waterfall: {
    mode: 'duration',
    metric: 'duration',
    max: 1,
    colPx: 200,
    t0: 0,
    valuesMode: 'off',
    valueFormat: 'relative',
    timestampTz: 'local',
    explainValue: false,
    popoverLayout: 'auto',
    panelPx: 0,
  },
  preflight: new Map(),
  onJumpTo: () => {},
  superseded: { latestNavStartedAtMs: NAV_AT, navStartsMs: [NAV_AT] },
  cdpEnhanced: true,
  connectionOpeners: new Map(),
  annotationCtx: { anchor: { latestNavStartedAtMs: NAV_AT, navStartsMs: [NAV_AT] }, source: 'cdp' },
  onAnnotationJump: () => {},
};

// CDP variant: the latest page committed under loader L2; rows bound to the
// superseded prior page (L1) read "(unknown)" by loader identity, even when
// they started after the nav floor (the slow-nav transition window).
const CTX_CDP: CellContext = { ...CTX, superseded: { latestNavStartedAtMs: NAV_AT, latestPageLoaderId: 'L2' } };

function cell(key: 'status' | 'time', over: RowOverrides, ctx: CellContext = CTX) {
  const row = makeRow(over);
  const sizeInfo = getSizeInfo(row.lifecycle, classifyRequestState(row.lifecycle));
  return render(renderCell(COLUMN_DEFS[key], row, sizeInfo, ctx));
}

// A prior-page, never-finished, no-status request (superseded by NAV_AT).
const preservedNoStatus: RowOverrides = {
  phase: 'pending',
  statusCode: undefined,
  statusText: undefined,
  startedAtMs: 500,
  har: [null],
};

describe('renderCell — preserved-unknown', () => {
  it('Status cell reads "(unknown)" with the page-unloaded tooltip', () => {
    const { container } = cell('status', preservedNoStatus);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('(unknown)');
    expect(span?.getAttribute('title')).toContain('unloaded while the request was in flight');
  });

  it('Time cell reads "(unknown)" with the same tooltip', () => {
    const { container } = cell('time', preservedNoStatus);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('(unknown)');
    expect(span?.getAttribute('title')).toContain('unloaded while the request was in flight');
  });

  it('a superseded header-only row (status, no body data) reads "(unknown)" in BOTH cells', () => {
    // Got a wire-level status but never received a byte (no lastActivityAtMs) →
    // the response is unconfirmed. The browser's own renderer-coupled panel
    // never recorded that status, so it shows "(unknown)"; we mirror it rather
    // than surfacing a header-only status the request never got to act on.
    const responded: RowOverrides = {
      phase: 'headers-received',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 500,
      har: [null],
    };
    expect(cell('status', responded).container.querySelector('span')?.textContent).toBe('(unknown)');
    expect(cell('time', responded).container.querySelector('span')?.textContent).toBe('(unknown)');
  });

  it('a superseded row that streamed data keeps its status even when the duration computes negative', () => {
    // Data DID flow (lastActivityAtMs set) but the elapsed arithmetic lands ≤ 0
    // (early-stream clock skew). The response is confirmed by the body bytes, so
    // the status survives; only the Time falls back to "(unknown)" (no
    // measurable duration). This is the safety guarantee: a status backed by
    // real data is never discarded just because the duration math went negative.
    const skewed: RowOverrides = {
      phase: 'headers-received',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 800,
      lastActivityAtMs: 700,
      har: [null],
    };
    expect(cell('status', skewed).container.querySelector('span')?.textContent).toBe('200');
    expect(cell('time', skewed).container.querySelector('span')?.textContent).toBe('(unknown)');
  });

  it('a superseded download-in-progress row shows its frozen Time, not "(unknown)"', () => {
    // Was downloading when the page unloaded: lastActivityAtMs advanced, so it
    // has a measurable (frozen) duration — the host keeps showing it (duration
    // precedes preserved), never "(unknown)".
    const downloading: RowOverrides = {
      phase: 'headers-received',
      statusCode: 206,
      statusText: 'Partial Content',
      startedAtMs: 500,
      lastActivityAtMs: 800,
      harOverrides: { status: 206, statusText: 'Partial Content' },
    };
    expect(cell('status', downloading).container.querySelector('span')?.textContent).toBe('206');
    const time = cell('time', downloading).container.querySelector('span')?.textContent;
    expect(time).not.toBe('(unknown)');
    expect(time).not.toBe('Pending');
    expect(time).toBeTruthy();
  });

  it('a current-page slow request still reads pending in both cells', () => {
    const current: RowOverrides = {
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      har: [null],
    };
    expect(cell('status', current).container.querySelector('span')?.textContent).toBe('(pending)');
    expect(cell('time', current).container.querySelector('span')?.textContent).toBe('Pending');
  });

  it('CDP: a transition-window row (old loader, started after the nav) reads "(unknown)" in both cells', () => {
    // Bound to the superseded prior page (L1) though it started after the nav
    // floor — loader identity supersedes it where the time floor would not.
    const transitionWindow: RowOverrides = {
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      loaderId: 'L1',
      har: [null],
    };
    expect(cell('status', transitionWindow, CTX_CDP).container.querySelector('span')?.textContent).toBe('(unknown)');
    expect(cell('time', transitionWindow, CTX_CDP).container.querySelector('span')?.textContent).toBe('(unknown)');
  });

  it('CDP: a current-page row (latest loader) reads pending even if it started before the nav floor', () => {
    const currentPage: RowOverrides = {
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 500,
      loaderId: 'L2',
      har: [null],
    };
    expect(cell('status', currentPage, CTX_CDP).container.querySelector('span')?.textContent).toBe('(pending)');
    expect(cell('time', currentPage, CTX_CDP).container.querySelector('span')?.textContent).toBe('Pending');
  });
});

// Status+Time list-cell coupling: a current-page in-flight row holds BOTH cells
// at pending until it resolves — a terminal outcome arrives, or live body data
// makes its duration measurable. The gate is `durationMs(lc) < 0`, so the
// heuristic path (no per-chunk data) honestly holds at pending for the whole
// download, while CDP (per-chunk `lastActivityAtMs`) reveals the status and a
// climbing time together. Terminal states always show their real outcome.
describe('renderCell — Status/Time coupling', () => {
  it('an in-flight row that has a status but no measurable duration holds both cells at pending', () => {
    // The response status arrived (CDP responseReceived) but no body byte has —
    // no measurable duration yet, so Status and Time stay coupled at pending
    // rather than revealing a status next to a blank/"Pending" time.
    const responding: RowOverrides = {
      phase: 'headers-received',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 1_500,
      har: [null],
    };
    expect(cell('status', responding).container.querySelector('span')?.textContent).toBe('(pending)');
    expect(cell('time', responding).container.querySelector('span')?.textContent).toBe('Pending');
  });

  it('a CDP-style in-flight row with live body data reveals the status and a climbing time together', () => {
    // `lastActivityAtMs` advances per data chunk → a measurable duration → both
    // cells resolve: the real 200 and the elapsed (climbing) time.
    const streaming: RowOverrides = {
      phase: 'headers-received',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 1_500,
      lastActivityAtMs: 1_800,
      harOverrides: { status: 200, statusText: 'OK' },
    };
    expect(cell('status', streaming).container.querySelector('span')?.textContent).toBe('200');
    const time = cell('time', streaming).container.querySelector('span')?.textContent;
    expect(time).not.toBe('Pending');
    expect(time).not.toBe('(pending)');
    expect(time).toBeTruthy();
  });

  it('a canceled row reads "(canceled)" and a real time, never "(pending)"', () => {
    // Terminal: `completedAtMs` is set alongside the abort error, so the
    // duration is measurable and the coupling reveals the real outcome.
    const canceled: RowOverrides = {
      phase: 'failed',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      completedAtMs: 1_800,
      error: { code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' },
      har: [null],
    };
    expect(cell('status', canceled).container.querySelector('span')?.textContent).toBe('(canceled)');
    const time = cell('time', canceled).container.querySelector('span')?.textContent;
    expect(time).not.toBe('Pending');
    expect(time).not.toBe('(pending)');
    expect(time).toBeTruthy();
  });

  it('a completed row reads its real status and duration', () => {
    const completed: RowOverrides = {
      phase: 'completed',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 1_500,
      completedAtMs: 1_800,
    };
    expect(cell('status', completed).container.querySelector('span')?.textContent).toBe('200');
    const time = cell('time', completed).container.querySelector('span')?.textContent;
    expect(time).not.toBe('Pending');
    expect(time).toBeTruthy();
  });
});

// Navigation-abandoned rows: a request torn down by its page unloading surfaces
// as `chrome.webRequest.onErrorOccurred` (net::ERR_ABORTED), which sets a
// terminal `completedAtMs` + a wire-level status the page never confirmed. When
// such an abort coincides with a superseding navigation, it reads "(unknown)" in
// both cells — matching the browser's renderer-coupled panel, which never saw
// that status. A cancellation on the still-current page stays a real "(canceled)".
describe('renderCell — navigation-abandoned', () => {
  it('a 200-then-abort with a navigation inside its in-flight window reads "(unknown)" in BOTH cells', () => {
    // The nav (NAV_AT = 1000) committed while the request was in flight
    // (500 → 1200), so it tore the request down → navigation-abandoned.
    const navAborted: RowOverrides = {
      phase: 'failed',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 500,
      completedAtMs: 1_200,
      error: { code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' },
      har: [null],
    };
    expect(cell('status', navAborted).container.querySelector('span')?.textContent).toBe('(unknown)');
    expect(cell('time', navAborted).container.querySelector('span')?.textContent).toBe('(unknown)');
  });

  it('a request canceled before a later navigation stays "(canceled)", never flips to "(unknown)"', () => {
    // Canceled at 400 — entirely before the nav floor (1000). No nav inside its
    // in-flight window (200, 400], so a later navigation must not retroactively
    // turn a real cancel into "(unknown)".
    const canceledThenNav: RowOverrides = {
      phase: 'failed',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 200,
      completedAtMs: 400,
      error: { code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' },
      har: [null],
    };
    expect(cell('status', canceledThenNav).container.querySelector('span')?.textContent).toBe('(canceled)');
    expect(cell('time', canceledThenNav).container.querySelector('span')?.textContent).not.toBe('(unknown)');
  });

  it('a cancellation on the still-current page stays "(canceled)" with a real time', () => {
    const userCanceled: RowOverrides = {
      phase: 'failed',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500, // after the nav floor → current page, not superseded
      completedAtMs: 1_800,
      error: { code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' },
      har: [null],
    };
    expect(cell('status', userCanceled).container.querySelector('span')?.textContent).toBe('(canceled)');
    const time = cell('time', userCanceled).container.querySelector('span')?.textContent;
    expect(time).not.toBe('(unknown)');
    expect(time).toBeTruthy();
  });

  it('a 200-then-abort on the current page keeps "200" (host parity), not "(unknown)"', () => {
    const abortedCurrent: RowOverrides = {
      phase: 'failed',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 1_500, // current page
      completedAtMs: 1_800,
      error: { code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' },
      har: [null],
    };
    expect(cell('status', abortedCurrent).container.querySelector('span')?.textContent).toBe('200');
  });
});

// Waterfall inline value for a no-timing in-flight row: it reads the row's
// state ("(unknown)" / "Pending") instead of a blank or a misleading "0 ms".
// (valuesMode 'always' so the value chip is in the DOM.)
const WF_CTX: CellContext = {
  ...CTX,
  waterfall: {
    mode: 'duration',
    metric: 'duration',
    max: 1,
    colPx: 200,
    t0: 0,
    valuesMode: 'always',
    valueFormat: 'relative',
    timestampTz: 'local',
    explainValue: false,
    popoverLayout: 'auto',
    panelPx: 0,
  },
};

function waterfallCell(over: RowOverrides) {
  const row = makeRow(over);
  const sizeInfo = getSizeInfo(row.lifecycle, classifyRequestState(row.lifecycle));
  return render(renderCell(COLUMN_DEFS.waterfall, row, sizeInfo, WF_CTX));
}

describe('renderCell — waterfall inline state', () => {
  it('a superseded no-timing row reads "(unknown)" on the bar', () => {
    const { container } = waterfallCell(preservedNoStatus);
    expect(container.querySelector('.dt-wf-vallabel')?.textContent).toBe('(unknown)');
  });

  it('a current-page no-timing row reads "Pending" on the bar', () => {
    const current: RowOverrides = {
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      startedAtMs: 1_500,
      har: [null],
    };
    expect(waterfallCell(current).container.querySelector('.dt-wf-vallabel')?.textContent).toBe('Pending');
  });
});
