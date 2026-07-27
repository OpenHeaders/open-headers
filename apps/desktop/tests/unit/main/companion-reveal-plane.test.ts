import { setHostLogger } from '@openheaders/core/logger';
import type { CompanionRevealTarget } from '@openheaders/core/protocol';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCompanionRevealPeerRpc } from '../../../src/main/companion-reveal-plane';

beforeAll(() => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

function makeRig() {
  const revealed: CompanionRevealTarget[] = [];
  const clock = { at: 0 };
  const plane = createCompanionRevealPeerRpc({
    reveal: (target) => revealed.push(target),
    now: () => clock.at,
  });
  return { plane, revealed, clock };
}

const LOOPBACK_PEER = { userId: 'user-1', isLoopback: true };

describe('companion-reveal peer plane', () => {
  it('owns only the companionReveal channel', () => {
    const { plane } = makeRig();
    expect(plane.owns('companionReveal')).toBe(true);
    expect(plane.owns('executeRequest')).toBe(false);
    expect(plane.owns('focusApp')).toBe(false);
  });

  it('reveals a valid target for a loopback peer', async () => {
    const { plane, revealed } = makeRig();
    const result = await plane.dispatch({ type: 'companionReveal', target: 'terminal' }, LOOPBACK_PEER);
    expect(result).toEqual({ ok: true });
    expect(revealed).toEqual(['terminal']);
  });

  it('accepts every vocabulary target', async () => {
    const { plane, revealed, clock } = makeRig();
    const targets: CompanionRevealTarget[] = [
      'workbench',
      'terminal',
      'git',
      'proxy',
      'liveNetwork',
      'mcp',
      'peerExecuteSetting',
    ];
    for (const target of targets) {
      await plane.dispatch({ type: 'companionReveal', target }, LOOPBACK_PEER);
      clock.at += 1_000;
    }
    expect(revealed).toEqual(targets);
  });

  it('coalesces repeat frames inside the debounce window without re-revealing', async () => {
    const { plane, revealed, clock } = makeRig();
    await plane.dispatch({ type: 'companionReveal', target: 'terminal' }, LOOPBACK_PEER);
    clock.at += 999;
    const coalesced = await plane.dispatch({ type: 'companionReveal', target: 'git' }, LOOPBACK_PEER);
    expect(coalesced).toEqual({ ok: true });
    expect(revealed).toEqual(['terminal']);
    clock.at += 1;
    await plane.dispatch({ type: 'companionReveal', target: 'git' }, LOOPBACK_PEER);
    expect(revealed).toEqual(['terminal', 'git']);
  });

  it('refuses an off-device peer without revealing', async () => {
    const { plane, revealed } = makeRig();
    const lan = await plane.dispatch({ type: 'companionReveal', target: 'terminal' }, { userId: 'user-1' });
    expect(lan).toMatchObject({ ok: false });
    const explicit = await plane.dispatch(
      { type: 'companionReveal', target: 'terminal' },
      { userId: 'user-1', isLoopback: false },
    );
    expect(explicit).toMatchObject({ ok: false });
    expect(revealed).toEqual([]);
  });

  it('refuses an unknown or missing target without revealing or arming the debounce', async () => {
    const { plane, revealed } = makeRig();
    expect(await plane.dispatch({ type: 'companionReveal', target: 'settings' }, LOOPBACK_PEER)).toMatchObject({
      ok: false,
    });
    expect(await plane.dispatch({ type: 'companionReveal' }, LOOPBACK_PEER)).toMatchObject({ ok: false });
    expect(revealed).toEqual([]);
    // A refusal must not consume the coalescing window — the next valid
    // frame still reveals.
    await plane.dispatch({ type: 'companionReveal', target: 'terminal' }, LOOPBACK_PEER);
    expect(revealed).toEqual(['terminal']);
  });
});
