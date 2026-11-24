import type { IncomingLifelinePort } from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngineReadiness } from '@/main/bootstrap/engine-readiness';
import { createLifelinePortRegistry } from '@/main/lifeline/port-registry';
import { createSurfaceViewers } from '@/main/lifeline/surface-viewers';

beforeAll(() => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

const SURFACE = 1;
const OTHER_SURFACE = 2;

interface AcceptedPort {
  readonly port: IncomingLifelinePort;
  readonly frames: unknown[];
  readonly disconnects: Array<{ errorMessage?: string }>;
}

function makeRig() {
  const readiness = createEngineReadiness();
  const viewers = createSurfaceViewers();
  const posted: Array<{ wcId: number; portId: string; message: unknown }> = [];
  const hostClosed: Array<{ wcId: number; portId: string }> = [];
  const registry = createLifelinePortRegistry({
    readiness,
    viewers,
    postToSurface: (wcId, portId, message) => posted.push({ wcId, portId, message }),
    disconnectToSurface: (wcId, portId) => hostClosed.push({ wcId, portId }),
  });
  /** Register an acceptor the way the engine boot does — it claims every port. */
  function installAcceptor(): AcceptedPort[] {
    const accepted: AcceptedPort[] = [];
    registry.server.onConnect((port) => {
      const entry: AcceptedPort = { port, frames: [], disconnects: [] };
      port.onMessage((frame) => entry.frames.push(frame));
      port.onDisconnect((info) => entry.disconnects.push(info));
      accepted.push(entry);
    });
    return accepted;
  }
  return { readiness, viewers, registry, posted, hostClosed, installAcceptor };
}

/** Let the continuations of an already-settled gate run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('lifeline port registry', () => {
  describe('with the engine ready', () => {
    it('admits a port to the acceptors at once', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();

      await expect(registry.open(SURFACE, 'port-1', 'oh-tabs')).resolves.toEqual({ ok: true });

      expect(accepted.map((entry) => entry.port.name)).toEqual(['oh-tabs']);
    });

    it('routes surface frames up and host frames down the owning port', async () => {
      const { readiness, registry, posted, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-lifecycle:7@ext-1');

      registry.message(SURFACE, 'port-1', { kind: 'subscribe' });
      accepted[0].port.postMessage({ kind: 'ready' });

      expect(accepted[0].frames).toEqual([{ kind: 'subscribe' }]);
      expect(posted).toEqual([{ wcId: SURFACE, portId: 'port-1', message: { kind: 'ready' } }]);
    });

    it('disconnects a port on its close and sends nothing down it afterwards', async () => {
      const { readiness, registry, posted, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-tabs');

      registry.close(SURFACE, 'port-1');
      accepted[0].port.postMessage({ kind: 'peer-gone' });

      expect(accepted[0].disconnects).toEqual([{}]);
      expect(posted).toEqual([]);
    });

    it('disconnects only the ports of a surface that went away, with the reason', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-tabs');
      await registry.open(OTHER_SURFACE, 'port-2', 'oh-tabs');

      registry.dropSurface(SURFACE, { errorMessage: 'render process gone' });

      expect(accepted[0].disconnects).toEqual([{ errorMessage: 'render process gone' }]);
      expect(accepted[1].disconnects).toEqual([]);
    });

    it('ignores another surface addressing a port it does not own', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-tabs');

      registry.message(OTHER_SURFACE, 'port-1', { kind: 'subscribe' });
      registry.close(OTHER_SURFACE, 'port-1');

      expect(accepted[0].frames).toEqual([]);
      expect(accepted[0].disconnects).toEqual([]);
    });

    it('refuses a portId that is already open', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-tabs');

      await expect(registry.open(OTHER_SURFACE, 'port-1', 'oh-tabs')).resolves.toEqual({
        ok: false,
        error: 'portId already open',
      });
      expect(accepted).toHaveLength(1);
    });

    it('keeps admitting to the other acceptors when one throws', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      registry.server.onConnect(() => {
        throw new Error('acceptor failed');
      });
      const accepted = installAcceptor();
      readiness.signalReady();

      await expect(registry.open(SURFACE, 'port-1', 'oh-tabs')).resolves.toEqual({ ok: true });
      expect(accepted).toHaveLength(1);
    });
  });

  describe('before the engine is ready', () => {
    it('holds an open and admits it to the acceptors the boot registered meanwhile', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');
      let settled = false;
      void opening.then(() => {
        settled = true;
      });

      // The engine boot registers its acceptors after the window opened the port.
      const accepted = installAcceptor();
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(accepted).toEqual([]);

      readiness.signalReady();
      await expect(opening).resolves.toEqual({ ok: true });
      expect(accepted.map((entry) => entry.port.name)).toEqual(['oh-tabs']);
    });

    it('delivers the frames posted while held, in order, once the acceptor has the port', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const opening = registry.open(SURFACE, 'port-1', 'oh.awareness.lifeline:surface-1');
      registry.message(SURFACE, 'port-1', { kind: 'bind', workspaceId: 'ws-1' });
      registry.message(SURFACE, 'port-1', { kind: 'bind', workspaceId: 'ws-2' });
      const accepted = installAcceptor();

      readiness.signalReady();
      await opening;

      expect(accepted[0].frames).toEqual([
        { kind: 'bind', workspaceId: 'ws-1' },
        { kind: 'bind', workspaceId: 'ws-2' },
      ]);
    });

    it('admits held opens in the order they arrived', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const openings = [
        registry.open(SURFACE, 'port-1', 'oh.awareness.lifeline:surface-1'),
        registry.open(SURFACE, 'port-2', 'oh-tabs'),
        registry.open(SURFACE, 'port-3', 'oh-lifecycle:7@ext-1'),
      ];
      const accepted = installAcceptor();

      readiness.signalReady();
      await Promise.all(openings);

      expect(accepted.map((entry) => entry.port.name)).toEqual([
        'oh.awareness.lifeline:surface-1',
        'oh-tabs',
        'oh-lifecycle:7@ext-1',
      ]);
    });

    it('admits a held open before anything that started waiting on the engine after it', async () => {
      const { readiness, registry } = makeRig();
      const order: string[] = [];
      registry.server.onConnect(() => order.push('port admitted'));
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');
      void readiness.whenReady().then(() => order.push('later call released'));

      readiness.signalReady();
      await opening;

      expect(order).toEqual(['port admitted', 'later call released']);
    });

    it('never hands an acceptor a port the surface closed while it was held', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');
      registry.message(SURFACE, 'port-1', { kind: 'subscribe' });
      registry.close(SURFACE, 'port-1');
      const accepted = installAcceptor();

      readiness.signalReady();

      await expect(opening).resolves.toEqual({ ok: false, error: 'closed while it was held at the door' });
      expect(accepted).toEqual([]);
    });

    it('never hands an acceptor a port whose surface went away while it was held', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const gone = registry.open(SURFACE, 'port-1', 'oh-tabs');
      const alive = registry.open(OTHER_SURFACE, 'port-2', 'oh-tabs');
      registry.dropSurface(SURFACE, {});
      const accepted = installAcceptor();

      readiness.signalReady();

      await expect(gone).resolves.toEqual({ ok: false, error: 'closed while it was held at the door' });
      await expect(alive).resolves.toEqual({ ok: true });
      expect(accepted).toHaveLength(1);
    });

    it('ignores another surface addressing a held port', async () => {
      const { readiness, registry, installAcceptor } = makeRig();
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');
      registry.message(OTHER_SURFACE, 'port-1', { kind: 'subscribe' });
      registry.close(OTHER_SURFACE, 'port-1');
      const accepted = installAcceptor();

      readiness.signalReady();

      await expect(opening).resolves.toEqual({ ok: true });
      expect(accepted[0].frames).toEqual([]);
    });

    it('refuses a portId that is already held', async () => {
      const { readiness, registry } = makeRig();
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');

      await expect(registry.open(OTHER_SURFACE, 'port-1', 'oh-tabs')).resolves.toEqual({
        ok: false,
        error: 'portId already open',
      });

      readiness.signalReady();
      await expect(opening).resolves.toEqual({ ok: true });
    });

    it('serves a port normally after it was held', async () => {
      const { readiness, registry, posted, installAcceptor } = makeRig();
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');
      const accepted = installAcceptor();
      readiness.signalReady();
      await opening;

      registry.message(SURFACE, 'port-1', { kind: 'subscribe' });
      accepted[0].port.postMessage({ kind: 'peer-tabs' });
      registry.close(SURFACE, 'port-1');

      expect(accepted[0].frames).toEqual([{ kind: 'subscribe' }]);
      expect(posted).toEqual([{ wcId: SURFACE, portId: 'port-1', message: { kind: 'peer-tabs' } }]);
      expect(accepted[0].disconnects).toEqual([{}]);
    });
  });

  describe('with the window closed to the tray', () => {
    const PRESENCE = 'oh.awareness.lifeline:surface-1';
    const VIEWS = ['oh-tabs', 'oh-lifecycle:7@ext-1', 'oh-console:7@ext-1', 'oh-storage:7@ext-1', 'oh-replay:arch-1'];

    it('disconnects the view ports on both sides when the window closes, and keeps presence', async () => {
      const { readiness, viewers, registry, hostClosed, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'presence', PRESENCE);
      for (const name of VIEWS) await registry.open(SURFACE, `port:${name}`, name);

      viewers.set(SURFACE, false);

      expect(accepted[0].disconnects).toEqual([]);
      for (const entry of accepted.slice(1)) expect(entry.disconnects).toEqual([{}]);
      expect(hostClosed).toEqual(VIEWS.map((name) => ({ wcId: SURFACE, portId: `port:${name}` })));
    });

    it('sends nothing down a view port once its window closed', async () => {
      const { readiness, viewers, registry, posted, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-tabs');

      viewers.set(SURFACE, false);
      accepted[0].port.postMessage({ kind: 'peer-tabs' });

      expect(posted).toEqual([]);
    });

    it('leaves the view ports of another surface alone', async () => {
      const { readiness, viewers, registry, hostClosed, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-tabs');
      await registry.open(OTHER_SURFACE, 'port-2', 'oh-tabs');

      viewers.set(SURFACE, false);

      expect(accepted[1].disconnects).toEqual([]);
      expect(hostClosed).toEqual([{ wcId: SURFACE, portId: 'port-1' }]);
    });

    it('holds a view channel the closed window opens, and admits it with its handshake when the window opens', async () => {
      const { readiness, viewers, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      viewers.set(SURFACE, false);

      const opening = registry.open(SURFACE, 'port-1', 'oh-lifecycle:7@ext-1');
      registry.message(SURFACE, 'port-1', { kind: 'subscribe' });
      await settle();
      expect(accepted).toEqual([]);

      viewers.set(SURFACE, true);
      await expect(opening).resolves.toEqual({ ok: true });
      expect(accepted.map((entry) => entry.port.name)).toEqual(['oh-lifecycle:7@ext-1']);
      expect(accepted[0].frames).toEqual([{ kind: 'subscribe' }]);
    });

    it('admits presence at once from a closed window', async () => {
      const { readiness, viewers, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      viewers.set(SURFACE, false);

      await expect(registry.open(SURFACE, 'port-1', PRESENCE)).resolves.toEqual({ ok: true });
      expect(accepted.map((entry) => entry.port.name)).toEqual([PRESENCE]);
    });

    it('admits the held view channels in the order they arrived', async () => {
      const { readiness, viewers, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      viewers.set(SURFACE, false);
      const openings = VIEWS.map((name) => registry.open(SURFACE, `port:${name}`, name));

      viewers.set(SURFACE, true);
      await Promise.all(openings);

      expect(accepted.map((entry) => entry.port.name)).toEqual(VIEWS);
    });

    it('keeps a view channel held through the boot of a window launched hidden', async () => {
      const { readiness, viewers, registry, installAcceptor } = makeRig();
      viewers.set(SURFACE, false);
      const presence = registry.open(SURFACE, 'port-1', PRESENCE);
      const tabs = registry.open(SURFACE, 'port-2', 'oh-tabs');
      const accepted = installAcceptor();

      readiness.signalReady();
      await expect(presence).resolves.toEqual({ ok: true });
      await settle();
      expect(accepted.map((entry) => entry.port.name)).toEqual([PRESENCE]);

      viewers.set(SURFACE, true);
      await expect(tabs).resolves.toEqual({ ok: true });
      expect(accepted.map((entry) => entry.port.name)).toEqual([PRESENCE, 'oh-tabs']);
    });

    it('keeps holding when the window closes again before the held open resumed', async () => {
      const { readiness, viewers, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      viewers.set(SURFACE, false);
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');
      await settle();

      viewers.set(SURFACE, true);
      viewers.set(SURFACE, false);
      await settle();
      expect(accepted).toEqual([]);

      viewers.set(SURFACE, true);
      await expect(opening).resolves.toEqual({ ok: true });
      expect(accepted).toHaveLength(1);
    });

    it('never hands an acceptor a view channel the surface closed while it was held', async () => {
      const { readiness, viewers, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      viewers.set(SURFACE, false);
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');
      registry.close(SURFACE, 'port-1');

      viewers.set(SURFACE, true);

      await expect(opening).resolves.toEqual({ ok: false, error: 'closed while it was held at the door' });
      expect(accepted).toEqual([]);
    });

    it('lets go of a held view channel when its surface goes away', async () => {
      const { readiness, viewers, registry, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      viewers.set(SURFACE, false);
      const opening = registry.open(SURFACE, 'port-1', 'oh-tabs');

      registry.dropSurface(SURFACE, {});
      viewers.forget(SURFACE);

      await expect(opening).resolves.toEqual({ ok: false, error: 'closed while it was held at the door' });
      expect(accepted).toEqual([]);
    });

    it('serves a reopened window like one that never closed', async () => {
      const { readiness, viewers, registry, posted, hostClosed, installAcceptor } = makeRig();
      const accepted = installAcceptor();
      readiness.signalReady();
      await registry.open(SURFACE, 'port-1', 'oh-tabs');
      viewers.set(SURFACE, false);
      viewers.set(SURFACE, true);

      await expect(registry.open(SURFACE, 'port-2', 'oh-tabs')).resolves.toEqual({ ok: true });
      accepted[1].port.postMessage({ kind: 'peers', nodeIds: [] });

      expect(posted).toEqual([{ wcId: SURFACE, portId: 'port-2', message: { kind: 'peers', nodeIds: [] } }]);
      expect(hostClosed).toEqual([{ wcId: SURFACE, portId: 'port-1' }]);
    });
  });
});
