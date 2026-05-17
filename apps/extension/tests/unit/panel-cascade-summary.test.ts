import { computeCascadeSummary } from '@openheaders/ui/panel/data/cascade-summary';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

let _arrival = 0;
function entry(url: string, opts: { bytes?: number; duration?: number; status?: number } = {}): InspectorRequest {
  const t = ++_arrival * 100;
  return {
    id: `GET|${url}|${t}`,
    method: 'GET',
    url,
    timestamp: t,
    duration: opts.duration ?? 0,
    statusCode: opts.status ?? 200,
    fires: [],
    arrivalIndex: _arrival,
    displayId: _arrival,
    harEntry: {
      response: { status: opts.status ?? 200, bodySize: opts.bytes ?? 0, content: { size: opts.bytes ?? 0, mimeType: 'text/plain' } },
    } as InspectorRequest['harEntry'],
  } as InspectorRequest;
}

function getChildrenFrom(map: Map<string, InspectorRequest[]>) {
  return (url: string) => map.get(url) ?? [];
}

describe('computeCascadeSummary', () => {
  it('returns zero stats when root has no children', () => {
    const root = entry('https://openheaders.io/');
    const out = computeCascadeSummary(root, () => [], 'https://openheaders.io');
    expect(out.requestCount).toBe(0);
    expect(out.transferredBytes).toBe(0);
    expect(out.cumulativeMs).toBe(0);
    expect(out.failedCount).toBe(0);
  });

  it('aggregates direct children + grandchildren into totals', () => {
    const root = entry('https://openheaders.io/');
    const a = entry('https://openheaders.io/a.js', { bytes: 1000, duration: 100 });
    const b = entry('https://openheaders.io/b.css', { bytes: 2000, duration: 200 });
    const c = entry('https://openheaders.io/c.woff', { bytes: 3000, duration: 50 });
    const map = new Map<string, InspectorRequest[]>([
      [root.url, [a, b]],
      [b.url, [c]],
    ]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.requestCount).toBe(3);
    expect(out.transferredBytes).toBe(6000);
    expect(out.cumulativeMs).toBe(350);
    expect(out.subtreeStats.get(b.id)?.count).toBe(1);
    expect(out.subtreeStats.get(b.id)?.bytes).toBe(3000);
  });

  it('counts failures across the cascade', () => {
    const root = entry('https://openheaders.io/');
    const a = entry('https://openheaders.io/a.js', { bytes: 100, status: 404 });
    const b = entry('https://openheaders.io/b.js', { bytes: 100, status: 200 });
    const map = new Map([[root.url, [a, b]]]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.failedCount).toBe(1);
  });

  it('attributes third-party bytes correctly against pageOrigin', () => {
    const root = entry('https://openheaders.io/');
    const own = entry('https://openheaders.io/local.js', { bytes: 1000 });
    const third = entry('https://cdn.example.com/lib.js', { bytes: 2500 });
    const map = new Map([[root.url, [own, third]]]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.transferredBytes).toBe(3500);
    expect(out.thirdPartyBytes).toBe(2500);
  });

  it('groups bytes by host', () => {
    const root = entry('https://openheaders.io/');
    const a = entry('https://cdn.example.com/x', { bytes: 100 });
    const b = entry('https://cdn.example.com/y', { bytes: 200 });
    const c = entry('https://other.example.com/z', { bytes: 50 });
    const map = new Map([[root.url, [a, b, c]]]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.byHost.get('cdn.example.com')?.count).toBe(2);
    expect(out.byHost.get('cdn.example.com')?.bytes).toBe(300);
    expect(out.byHost.get('other.example.com')?.bytes).toBe(50);
  });

  it('cycle-guards self-referencing chains', () => {
    const root = entry('https://openheaders.io/');
    const a = entry('https://openheaders.io/a.js', { bytes: 100 });
    // a re-initiates root → cycle
    const map = new Map<string, InspectorRequest[]>([
      [root.url, [a]],
      [a.url, [root]],
    ]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.requestCount).toBe(1);
  });
});
