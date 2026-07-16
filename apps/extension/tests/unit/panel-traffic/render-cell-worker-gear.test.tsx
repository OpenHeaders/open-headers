/**
 * Name-cell worker gear (SW-network Phase B) — a lifecycle stamped
 * `issuedByWorker` renders the browser's gear glyph (⚙) before the row
 * name; page-issued rows never do. Presence-gated on the additive
 * started-only provenance field alone.
 */

import { COLUMN_DEFS } from '@openheaders/ui/panel/components/traffic/columns';
import { type CellContext, renderCell } from '@openheaders/ui/panel/components/traffic/render-cell';
import { classifyRequestState } from '@openheaders/ui/panel/data/request-state';
import { getSizeInfo } from '@openheaders/ui/panel/data/size-info';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeRow, type RowOverrides } from '../../__factories__/lifecycle';

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
  superseded: { latestNavStartedAtMs: 0, navStartsMs: [] },
  cdpEnhanced: true,
  connectionOpeners: new Map(),
  resolvedInitiators: new Map(),
  annotationCtx: { anchor: { latestNavStartedAtMs: 0, navStartsMs: [] }, source: 'cdp' },
  onAnnotationJump: () => {},
};

function nameCell(over: RowOverrides) {
  const row = makeRow(over);
  const sizeInfo = getSizeInfo(row.lifecycle, classifyRequestState(row.lifecycle));
  return render(renderCell(COLUMN_DEFS.name, row, sizeInfo, CTX));
}

describe('renderCell — worker gear', () => {
  it('renders the gear before the name on a worker-issued row', () => {
    const { container } = nameCell({ issuedByWorker: 'service-worker' });
    const gear = container.querySelector('.dt-col-name-gear');
    const text = container.querySelector('.dt-col-name-text');
    if (gear === null || text === null) throw new Error('expected gear + name text');
    expect(gear.textContent).toBe('⚙');
    expect(gear.getAttribute('title')).toContain('service worker');
    // The gear precedes the name text (DOCUMENT_POSITION_FOLLOWING on text).
    expect(gear.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no gear on a page-issued row', () => {
    const { container } = nameCell({});
    expect(container.querySelector('.dt-col-name-gear')).toBeNull();
  });
});
