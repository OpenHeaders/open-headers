import { EventEmitter } from 'node:events';
import { getLifelineServer, type IncomingLifelinePort } from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import { ipcMain, webContents } from 'electron';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createEngineReadiness } from '@/main/bootstrap/engine-readiness';
import { installLifelineServer } from '@/main/install-lifeline-server';
import { createSurfaceViewers } from '@/main/lifeline/surface-viewers';

beforeAll(() => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

type OpenHandler = (event: { sender: Electron.WebContents }, raw: unknown) => unknown;
type FrameListener = (event: { sender: Electron.WebContents }, raw: unknown) => void;

/** A renderer surface as the adapter sees it: an id, a send, lifecycle events. */
function makeSurface(id: number) {
  const emitter = new EventEmitter();
  const sent: Array<{ channel: string; payload: unknown }> = [];
  const surface = Object.assign(emitter, {
    id,
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
  });
  return { sender: surface as unknown as Electron.WebContents, emitter, sent };
}

function installAdapter() {
  let open: OpenHandler | undefined;
  const listeners = new Map<string, FrameListener>();
  vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: OpenHandler) => {
    if (channel === 'oh:lifeline:open') open = fn;
  }) as typeof ipcMain.handle);
  vi.spyOn(ipcMain, 'on').mockImplementation(((channel: string, fn: FrameListener) => {
    listeners.set(channel, fn);
    return ipcMain;
  }) as typeof ipcMain.on);

  const readiness = createEngineReadiness();
  const viewers = createSurfaceViewers();
  installLifelineServer(readiness, viewers);
  if (!open) throw new Error('oh:lifeline:open handler was not registered');
  const openHandler = open;

  const accepted: IncomingLifelinePort[] = [];
  const disconnects: Array<{ errorMessage?: string }> = [];
  const frames: unknown[] = [];
  getLifelineServer().onConnect((port) => {
    accepted.push(port);
    port.onMessage((frame) => frames.push(frame));
    port.onDisconnect((info) => disconnects.push(info));
  });

  return {
    readiness,
    viewers,
    accepted,
    disconnects,
    frames,
    // `ipcMain.handle` takes a plain or a promised answer; the wire awaits either.
    open: (sender: Electron.WebContents, raw: unknown) => Promise.resolve(openHandler({ sender }, raw)),
    post: (sender: Electron.WebContents, raw: unknown) => listeners.get('oh:lifeline:message')?.({ sender }, raw),
    close: (sender: Electron.WebContents, raw: unknown) => listeners.get('oh:lifeline:close')?.({ sender }, raw),
  };
}

describe('lifeline IPC adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an open without a port id and a name', async () => {
    const adapter = installAdapter();
    const { sender } = makeSurface(1);
    adapter.readiness.signalReady();

    await expect(adapter.open(sender, { name: 'oh-tabs' })).resolves.toEqual({
      ok: false,
      error: 'invalid open payload',
    });
    await expect(adapter.open(sender, undefined)).resolves.toEqual({ ok: false, error: 'invalid open payload' });
    expect(adapter.accepted).toEqual([]);
  });

  it('carries a port opened during boot, and its handshake, to the acceptor once the engine is ready', async () => {
    const adapter = installAdapter();
    const { sender } = makeSurface(1);

    const opening = adapter.open(sender, { portId: 'port-1', name: 'oh-tabs' });
    adapter.post(sender, { portId: 'port-1', message: { kind: 'subscribe' } });
    await Promise.resolve();
    expect(adapter.accepted).toEqual([]);

    adapter.readiness.signalReady();
    await expect(opening).resolves.toEqual({ ok: true });
    expect(adapter.accepted.map((port) => port.name)).toEqual(['oh-tabs']);
    expect(adapter.frames).toEqual([{ kind: 'subscribe' }]);
  });

  it('drops an open held for a window that was destroyed before the engine was ready', async () => {
    const adapter = installAdapter();
    const { sender, emitter } = makeSurface(1);

    const opening = adapter.open(sender, { portId: 'port-1', name: 'oh-tabs' });
    emitter.emit('destroyed');
    adapter.readiness.signalReady();

    await expect(opening).resolves.toEqual({ ok: false, error: 'closed while it was held at the door' });
    expect(adapter.accepted).toEqual([]);
  });

  it('pushes host frames to the owning window on the host-message channel', async () => {
    const adapter = installAdapter();
    const { sender, sent } = makeSurface(7);
    vi.spyOn(webContents, 'fromId').mockImplementation(((id: number) =>
      id === 7 ? sender : undefined) as typeof webContents.fromId);
    adapter.readiness.signalReady();
    await adapter.open(sender, { portId: 'port-1', name: 'oh-tabs' });

    adapter.accepted[0].postMessage({ kind: 'peer-tabs' });

    expect(sent).toEqual([
      { channel: 'oh:lifeline:host-message', payload: { portId: 'port-1', message: { kind: 'peer-tabs' } } },
    ]);
  });

  it('disconnects a port on the renderer close and on a renderer crash', async () => {
    const adapter = installAdapter();
    const closing = makeSurface(1);
    const crashing = makeSurface(2);
    adapter.readiness.signalReady();
    await adapter.open(closing.sender, { portId: 'port-1', name: 'oh-tabs' });
    await adapter.open(crashing.sender, { portId: 'port-2', name: 'oh-tabs' });

    adapter.close(closing.sender, { portId: 'port-1' });
    crashing.emitter.emit('render-process-gone');

    expect(adapter.disconnects).toEqual([{}, { errorMessage: 'render process gone' }]);
  });

  it('tells the window its view port ended when the window closes, and carries the reopened one to the acceptor', async () => {
    const adapter = installAdapter();
    const { sender, sent } = makeSurface(7);
    vi.spyOn(webContents, 'fromId').mockImplementation(((id: number) =>
      id === 7 ? sender : undefined) as typeof webContents.fromId);
    adapter.readiness.signalReady();
    await adapter.open(sender, { portId: 'port-1', name: 'oh-tabs' });

    adapter.viewers.set(7, false);

    expect(adapter.disconnects).toEqual([{}]);
    expect(sent).toEqual([{ channel: 'oh:lifeline:host-disconnect', payload: { portId: 'port-1' } }]);

    // The renderer's reconnect: held while the window is closed.
    const reopening = adapter.open(sender, { portId: 'port-2', name: 'oh-tabs' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(adapter.accepted).toHaveLength(1);

    adapter.viewers.set(7, true);
    await expect(reopening).resolves.toEqual({ ok: true });
    expect(adapter.accepted.map((port) => port.name)).toEqual(['oh-tabs', 'oh-tabs']);
  });
});
