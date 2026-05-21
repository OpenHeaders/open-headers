/**
 * `createMutex` — the shared tail-promise serializer extracted in the
 * cross-phase audit (one primitive replacing the three hand-rolled
 * serializers in `ensureWorkspaceRoleAssignments`, `daemon-auth-tokens`,
 * and the identity registry).
 *
 * Pinned invariants:
 *   - Queued operations never interleave — each runs start-to-finish
 *     before the next begins.
 *   - A rejected operation does not break the chain; the next queued op
 *     still runs, and the rejection surfaces to its own caller only.
 *   - Each caller observes its own operation's resolved value.
 */

import { describe, expect, it } from 'vitest';
import { createMutex } from '../../src/utils/mutex';

describe('createMutex', () => {
  it('serializes — concurrently-submitted operations never interleave', async () => {
    const mutex = createMutex();
    const log: string[] = [];
    const op = (id: string) => async (): Promise<void> => {
      log.push(`${id}:start`);
      // Several microtask yields — an unserialized peer would interleave here.
      await Promise.resolve();
      await Promise.resolve();
      log.push(`${id}:end`);
    };
    await Promise.all([mutex(op('a')), mutex(op('b')), mutex(op('c'))]);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('a rejected operation does not break the chain', async () => {
    const mutex = createMutex();
    const ran: string[] = [];
    const bad = mutex(async () => {
      throw new Error('boom');
    });
    const good = mutex(async () => {
      ran.push('ran');
      return 'ok';
    });
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('ok');
    expect(ran).toEqual(['ran']);
  });

  it('returns each operation result to its own caller', async () => {
    const mutex = createMutex();
    const [a, b] = await Promise.all([mutex(async () => 1), mutex(async () => 2)]);
    expect([a, b]).toEqual([1, 2]);
  });

  it('separate mutexes are independent locks', async () => {
    const log: string[] = [];
    const lockA = createMutex();
    const lockB = createMutex();
    const slow = lockA(async () => {
      await Promise.resolve();
      await Promise.resolve();
      log.push('a');
    });
    const fast = lockB(async () => {
      log.push('b');
    });
    await Promise.all([slow, fast]);
    // lockB's op is not held behind lockA's.
    expect(log).toEqual(['b', 'a']);
  });
});
