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
  },
  preflight: new Map(),
  onJumpTo: () => {},
  supersededFloorMs: NAV_AT,
  cdpEnhanced: true,
};

function cell(key: 'status' | 'time', over: RowOverrides) {
  const row = makeRow(over);
  const state = classifyRequestState(row.lifecycle);
  const sizeInfo = getSizeInfo(row.lifecycle, state);
  return render(renderCell(COLUMN_DEFS[key], row, state, sizeInfo, CTX));
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

  it('a superseded responded row with no data yet keeps its status, reads "(unknown)" in Time', () => {
    // Got a status but never received a byte (no lastActivityAtMs) → no
    // measurable duration → Time is "(unknown)", matching the host.
    const responded: RowOverrides = {
      phase: 'headers-received',
      statusCode: 200,
      statusText: 'OK',
      startedAtMs: 500,
    };
    expect(cell('status', responded).container.querySelector('span')?.textContent).toBe('200');
    expect(cell('time', responded).container.querySelector('span')?.textContent).toBe('(unknown)');
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
  },
};

function waterfallCell(over: RowOverrides) {
  const row = makeRow(over);
  const state = classifyRequestState(row.lifecycle);
  const sizeInfo = getSizeInfo(row.lifecycle, state);
  return render(renderCell(COLUMN_DEFS.waterfall, row, state, sizeInfo, WF_CTX));
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
