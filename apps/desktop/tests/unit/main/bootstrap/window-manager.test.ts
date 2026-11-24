import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events');
  const state = { launchHidden: false, quitting: false, nextSurfaceId: 1 };

  class FakeWebContents extends EventEmitter {
    constructor(readonly id: number) {
      super();
    }
  }

  class FakeWindow extends EventEmitter {
    readonly webContents = new FakeWebContents(state.nextSurfaceId++);
    visible = false;
    show(): void {
      this.visible = true;
    }
    hide(): void {
      this.visible = false;
    }
    focus(): void {}
    maximize(): void {}
    setFullScreen(): void {}
    restore(): void {}
    isMinimized(): boolean {
      return false;
    }
    isDestroyed(): boolean {
      return false;
    }
    loadURL(): Promise<void> {
      return Promise.resolve();
    }
    loadFile(): Promise<void> {
      return Promise.resolve();
    }
  }

  return { state, FakeWindow };
});

vi.mock('electron', () => ({
  app: { getName: () => 'Open Headers', isPackaged: false },
  BrowserWindow: fake.FakeWindow,
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1600, height: 1000 } }) },
}));
vi.mock('@/main/bootstrap/launch-flags', () => ({ shouldLaunchHidden: () => fake.state.launchHidden }));
vi.mock('@/main/bootstrap/launch-marker', () => ({ LAUNCH_MARKER: 'launch' }));
vi.mock('@/main/bootstrap/lifecycle', () => ({ isQuitting: () => fake.state.quitting }));
vi.mock('@/main/bootstrap/logger', () => ({
  createLogger: () => ({ error() {}, warn() {}, info() {}, debug() {} }),
}));
vi.mock('@/main/bootstrap/protocol', () => ({ markRendererReadyAndDrain() {}, resetRendererReady() {} }));
vi.mock('@/main/bootstrap/renderer-broadcast', () => ({ sendToRendererWindow: vi.fn() }));
vi.mock('@/main/bootstrap/security', () => ({ attachWindowSecurity() {} }));
vi.mock('@/main/bootstrap/window-chrome', () => ({
  frameBackgroundColor: () => '#000000',
  titleBarOverlayOptions: () => ({}),
}));
vi.mock('@/main/bootstrap/window-state', () => ({ attachWindowStateTracking() {}, loadWindowState: () => null }));
vi.mock('@/main/bootstrap/window-supervisor', () => ({ attachWindowSupervisor() {} }));
vi.mock('@/main/bootstrap/windows-foreground', () => ({ forceForegroundWindow() {} }));

/** A fresh window manager and the viewers it writes to — both hold module state. */
async function loadWindowManager() {
  vi.resetModules();
  const manager = await import('@/main/bootstrap/window-manager');
  const { surfaceViewers } = await import('@/main/lifeline/surface-viewers');
  return { manager, surfaceViewers };
}

type FakeWindow = InstanceType<typeof fake.FakeWindow>;

/** The window as the fake built it — the manager types it as the real one. */
function fakeOf(win: unknown): FakeWindow {
  if (!(win instanceof fake.FakeWindow)) throw new Error('the window manager did not build the fake window');
  return win;
}

function closeButton(win: FakeWindow): { preventDefault: ReturnType<typeof vi.fn> } {
  const event = { preventDefault: vi.fn() };
  win.emit('close', event);
  return event;
}

describe('window manager — the window as a viewer', () => {
  beforeEach(() => {
    fake.state.launchHidden = false;
    fake.state.quitting = false;
  });

  it('counts a window launched on screen as a viewer', async () => {
    const { manager, surfaceViewers } = await loadWindowManager();

    const win = fakeOf(manager.createMainWindow());

    expect(win.visible).toBe(true);
    expect(surfaceViewers.isViewer(win.webContents.id)).toBe(true);
  });

  it('does not count a window launched hidden until it is first opened', async () => {
    fake.state.launchHidden = true;
    const { manager, surfaceViewers } = await loadWindowManager();

    const win = fakeOf(manager.createMainWindow());
    expect(win.visible).toBe(false);
    expect(surfaceViewers.isViewer(win.webContents.id)).toBe(false);

    manager.showMainWindow();
    expect(win.visible).toBe(true);
    expect(surfaceViewers.isViewer(win.webContents.id)).toBe(true);
  });

  it('stops counting the window when it closes to the tray, and counts it again when reopened', async () => {
    const { manager, surfaceViewers } = await loadWindowManager();
    const win = fakeOf(manager.createMainWindow());

    const event = closeButton(win);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.visible).toBe(false);
    expect(surfaceViewers.isViewer(win.webContents.id)).toBe(false);

    manager.showMainWindow();
    expect(surfaceViewers.isViewer(win.webContents.id)).toBe(true);
  });

  it('leaves the window a viewer when the close is the app quitting', async () => {
    const { manager, surfaceViewers } = await loadWindowManager();
    const win = fakeOf(manager.createMainWindow());
    fake.state.quitting = true;

    const event = closeButton(win);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(surfaceViewers.isViewer(win.webContents.id)).toBe(true);
  });

  it('lets go of whatever waits on a closed window that is destroyed', async () => {
    const { manager, surfaceViewers } = await loadWindowManager();
    const win = fakeOf(manager.createMainWindow());
    closeButton(win);
    let released = false;
    void surfaceViewers.whenViewer(win.webContents.id).then(() => {
      released = true;
    });

    win.webContents.emit('destroyed');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(released).toBe(true);
  });
});
