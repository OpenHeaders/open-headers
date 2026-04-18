import { describe, expect, it, vi } from 'vitest';
import { withHostAccess } from '@/shared/fetch/with-host-access';

describe('withHostAccess', () => {
  it('returns the wrapped function result', async () => {
    const result = await withHostAccess('https://api.openheaders.io', () => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('invokes the callback exactly once', async () => {
    const fn = vi.fn(() => Promise.resolve('ok'));
    await withHostAccess('https://api.openheaders.io', fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('propagates errors thrown from the callback', async () => {
    await expect(withHostAccess('https://api.openheaders.io', () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
  });

  it('preserves the return type through generics', async () => {
    const out: { status: number } = await withHostAccess('https://api.openheaders.io', () =>
      Promise.resolve({ status: 200 }),
    );
    expect(out.status).toBe(200);
  });
});
