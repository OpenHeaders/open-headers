import { computeConnectionReuse } from '@openheaders/ui/panel/data/connection-reuse';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

let _arrival = 0;
function entry(url: string, connection?: string, ts?: number): InspectorRequest {
  const t = ts ?? ++_arrival * 100;
  return {
    id: `GET|${url}|${t}`,
    method: 'GET',
    url,
    timestamp: t,
    fires: [],
    arrivalIndex: _arrival,
    displayId: _arrival,
    harEntry: { connection } as InspectorRequest['harEntry'],
  } as InspectorRequest;
}

describe('computeConnectionReuse', () => {
  it('returns reused=false when the entry has no connection id', () => {
    const e = entry('https://openheaders.io/a');
    const out = computeConnectionReuse(e, [e]);
    expect(out.reused).toBe(false);
    expect(out.connectionId).toBeNull();
  });

  it('returns reused=false when the entry is the only one on its connection', () => {
    const e = entry('https://openheaders.io/a', 'CONN-1');
    const out = computeConnectionReuse(e, [e]);
    expect(out.reused).toBe(false);
  });

  it('marks reused=true when an earlier entry shares the connection', () => {
    const a = entry('https://openheaders.io/a', 'CONN-1', 100);
    const b = entry('https://openheaders.io/b', 'CONN-1', 200);
    const out = computeConnectionReuse(b, [a, b]);
    expect(out.reused).toBe(true);
    expect(out.openedBy?.url).toBe('https://openheaders.io/a');
  });

  it('does not mark itself as the opener', () => {
    const a = entry('https://openheaders.io/a', 'CONN-1', 100);
    const b = entry('https://openheaders.io/b', 'CONN-1', 200);
    expect(computeConnectionReuse(a, [a, b]).reused).toBe(false);
  });

  it('ignores entries on a different connection', () => {
    const a = entry('https://openheaders.io/a', 'CONN-1', 100);
    const b = entry('https://openheaders.io/b', 'CONN-2', 200);
    expect(computeConnectionReuse(b, [a, b]).reused).toBe(false);
  });
});
