import { describe, expect, it } from 'vitest';
import { createHeldOpens } from '@/main/lifeline/held-opens';

const SURFACE = 1;
const OTHER_SURFACE = 2;

describe('held opens', () => {
  it('keeps the frames posted to a held port in arrival order', () => {
    const heldOpens = createHeldOpens();
    const held = heldOpens.hold(SURFACE, 'port-1');

    expect(heldOpens.keepFrame(SURFACE, 'port-1', { kind: 'bind' })).toBe(true);
    expect(heldOpens.keepFrame(SURFACE, 'port-1', { kind: 'subscribe' })).toBe(true);

    expect(held.frames).toEqual([{ kind: 'bind' }, { kind: 'subscribe' }]);
    expect(held.canceled).toBe(false);
  });

  it('answers only the surface that holds the port', () => {
    const heldOpens = createHeldOpens();
    const held = heldOpens.hold(SURFACE, 'port-1');

    expect(heldOpens.keepFrame(OTHER_SURFACE, 'port-1', { kind: 'subscribe' })).toBe(false);
    expect(heldOpens.cancel(OTHER_SURFACE, 'port-1')).toBe(false);
    expect(heldOpens.keepFrame(SURFACE, 'port-unknown', { kind: 'subscribe' })).toBe(false);

    expect(held.frames).toEqual([]);
    expect(held.canceled).toBe(false);
  });

  it('cancels one port on its close and stops keeping its frames', () => {
    const heldOpens = createHeldOpens();
    const closed = heldOpens.hold(SURFACE, 'port-1');
    const waiting = heldOpens.hold(SURFACE, 'port-2');

    expect(heldOpens.cancel(SURFACE, 'port-1')).toBe(true);
    heldOpens.keepFrame(SURFACE, 'port-1', { kind: 'subscribe' });

    expect(closed.canceled).toBe(true);
    expect(closed.frames).toEqual([]);
    expect(waiting.canceled).toBe(false);
  });

  it('cancels everything a surface holds when it goes away', () => {
    const heldOpens = createHeldOpens();
    const first = heldOpens.hold(SURFACE, 'port-1');
    const second = heldOpens.hold(SURFACE, 'port-2');
    const foreign = heldOpens.hold(OTHER_SURFACE, 'port-3');

    heldOpens.cancelSurface(SURFACE);

    expect(first.canceled).toBe(true);
    expect(second.canceled).toBe(true);
    expect(foreign.canceled).toBe(false);
  });

  it('holds a port until it is released', () => {
    const heldOpens = createHeldOpens();
    const held = heldOpens.hold(SURFACE, 'port-1');
    expect(heldOpens.has('port-1')).toBe(true);

    heldOpens.release(held);
    expect(heldOpens.has('port-1')).toBe(false);
  });
});
