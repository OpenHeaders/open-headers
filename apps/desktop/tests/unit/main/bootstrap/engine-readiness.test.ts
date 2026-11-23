import { describe, expect, it } from 'vitest';
import { createEngineReadiness } from '@/main/bootstrap/engine-readiness';

describe('engine readiness gate', () => {
  it('is not ready until the boot is signaled', async () => {
    const readiness = createEngineReadiness();
    let released = false;
    void readiness.whenReady().then(() => {
      released = true;
    });

    await Promise.resolve();
    expect(readiness.isReady()).toBe(false);
    expect(released).toBe(false);

    readiness.signalReady();
    await readiness.whenReady();
    expect(readiness.isReady()).toBe(true);
    expect(released).toBe(true);
  });

  it('releases what it held in the order it arrived', async () => {
    const readiness = createEngineReadiness();
    const released: string[] = [];
    const waiters = ['rpc-1', 'lifeline-open', 'rpc-2'].map((label) =>
      readiness.whenReady().then(() => {
        released.push(label);
      }),
    );

    readiness.signalReady();
    await Promise.all(waiters);
    expect(released).toEqual(['rpc-1', 'lifeline-open', 'rpc-2']);
  });

  it('answers at once after the boot settled, however often it is signaled', async () => {
    const readiness = createEngineReadiness();
    readiness.signalReady();
    readiness.signalReady();
    await expect(readiness.whenReady()).resolves.toBeUndefined();
    expect(readiness.isReady()).toBe(true);
  });
});
