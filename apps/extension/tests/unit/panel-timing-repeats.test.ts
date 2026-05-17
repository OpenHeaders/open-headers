import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { computeRepeatStats } from '@openheaders/ui/panel/data/timing-repeats';
import { describe, expect, it } from 'vitest';

let _arrival = 0;
let _displayId = 0;
function entry(url: string, duration: number, method = 'GET', fromCache?: string): InspectorRequest {
  return {
    id: `${method}|${url}|${++_arrival}`,
    method,
    url,
    timestamp: _arrival * 100,
    duration,
    fires: [],
    arrivalIndex: _arrival,
    displayId: ++_displayId,
    harEntry: { _fromCache: fromCache } as InspectorRequest['harEntry'],
  } as InspectorRequest;
}

describe('computeRepeatStats', () => {
  it('returns null when the URL only appears once', () => {
    const e = entry('https://openheaders.io/a', 100);
    expect(computeRepeatStats(e, [e])).toBeNull();
  });

  it('reports fastest / median / slowest across same-URL same-method entries', () => {
    const a = entry('https://openheaders.io/a', 100);
    const b = entry('https://openheaders.io/a', 200);
    const c = entry('https://openheaders.io/a', 300);
    const out = computeRepeatStats(b, [a, b, c]);
    expect(out).not.toBeNull();
    expect(out!.count).toBe(3);
    expect(out!.fastestMs).toBe(100);
    expect(out!.medianMs).toBe(200);
    expect(out!.slowestMs).toBe(300);
    expect(out!.selectedIsSlowest).toBe(false);
    expect(out!.selectedIsFastest).toBe(false);
  });

  it('flags selectedIsSlowest / Fastest correctly', () => {
    const a = entry('https://openheaders.io/a', 100);
    const b = entry('https://openheaders.io/a', 200);
    expect(computeRepeatStats(a, [a, b])!.selectedIsFastest).toBe(true);
    expect(computeRepeatStats(b, [a, b])!.selectedIsSlowest).toBe(true);
  });

  it('does not pair entries with different methods', () => {
    const a = entry('https://openheaders.io/a', 100, 'GET');
    const b = entry('https://openheaders.io/a', 200, 'POST');
    expect(computeRepeatStats(a, [a, b])).toBeNull();
  });

  it('tallies cache outcomes across the repeat set', () => {
    const a = entry('https://openheaders.io/a', 100, 'GET');
    const b = entry('https://openheaders.io/a', 5, 'GET', 'memory');
    const c = entry('https://openheaders.io/a', 30, 'GET', 'disk');
    const d = entry('https://openheaders.io/a', 12, 'GET', 'service-worker');
    const out = computeRepeatStats(a, [a, b, c, d]);
    expect(out!.cacheCounts).toEqual({ miss: 1, memory: 1, disk: 1, serviceWorker: 1 });
  });
});
