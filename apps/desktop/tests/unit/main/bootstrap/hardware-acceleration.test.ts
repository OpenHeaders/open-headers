import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, dialog } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyHardwareAccelerationPolicy,
  isHardwareAccelerationDisabled,
  toggleHardwareAcceleration,
} from '@/main/bootstrap/hardware-acceleration';

const FLAG_FILENAME = 'disable-hardware-acceleration.flag';

describe('hardware-acceleration', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'oh-hw-accel-'));
    vi.spyOn(app, 'getPath').mockReturnValue(userDataDir);
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('reports enabled on a fresh profile', () => {
    expect(isHardwareAccelerationDisabled()).toBe(false);
  });

  it('does not disable acceleration when no flag is persisted', () => {
    const disable = vi.spyOn(app, 'disableHardwareAcceleration');
    applyHardwareAccelerationPolicy();
    expect(disable).not.toHaveBeenCalled();
  });

  it('toggle persists the disable flag and applies it on next boot', async () => {
    vi.spyOn(dialog, 'showMessageBox').mockResolvedValue({ response: 1, checkboxChecked: false });
    await toggleHardwareAcceleration();
    expect(existsSync(join(userDataDir, FLAG_FILENAME))).toBe(true);
    expect(isHardwareAccelerationDisabled()).toBe(true);

    const disable = vi.spyOn(app, 'disableHardwareAcceleration');
    applyHardwareAccelerationPolicy();
    expect(disable).toHaveBeenCalledOnce();
  });

  it('a second toggle before restart removes the flag again', async () => {
    vi.spyOn(dialog, 'showMessageBox').mockResolvedValue({ response: 1, checkboxChecked: false });
    await toggleHardwareAcceleration();
    await toggleHardwareAcceleration();
    expect(existsSync(join(userDataDir, FLAG_FILENAME))).toBe(false);
    expect(isHardwareAccelerationDisabled()).toBe(false);
  });

  it('declining the restart prompt does not relaunch', async () => {
    vi.spyOn(dialog, 'showMessageBox').mockResolvedValue({ response: 1, checkboxChecked: false });
    const relaunch = vi.spyOn(app, 'relaunch');
    const quit = vi.spyOn(app, 'quit');
    await toggleHardwareAcceleration();
    expect(relaunch).not.toHaveBeenCalled();
    expect(quit).not.toHaveBeenCalled();
  });

  it('offers the restart in the shipped keyed sentences, per direction', async () => {
    const show = vi.spyOn(dialog, 'showMessageBox').mockResolvedValue({ response: 1, checkboxChecked: false });
    await toggleHardwareAcceleration();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hardware Acceleration',
        message: 'Hardware acceleration will be disabled the next time OpenHeaders starts.',
        detail: 'Restart now to apply the change immediately.',
        buttons: ['Restart Now', 'Later'],
      }),
    );

    show.mockClear();
    await toggleHardwareAcceleration();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Hardware acceleration will be enabled the next time OpenHeaders starts.',
      }),
    );
  });

  it('accepting the restart prompt relaunches and quits', async () => {
    vi.spyOn(dialog, 'showMessageBox').mockResolvedValue({ response: 0, checkboxChecked: false });
    const relaunch = vi.spyOn(app, 'relaunch');
    const quit = vi.spyOn(app, 'quit');
    await toggleHardwareAcceleration();
    expect(relaunch).toHaveBeenCalledOnce();
    expect(quit).toHaveBeenCalledOnce();
  });
});
