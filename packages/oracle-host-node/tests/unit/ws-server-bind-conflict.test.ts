/**
 * A taken port must travel as a value, not as a process death.
 *
 * `ws` re-emits the HTTP server's `error` on the WebSocketServer, and an
 * emitter with no `error` listener throws — so a second instance on the
 * same port used to kill the process from inside that re-emit, leaving
 * the start promise unsettled: no rejection to report, no daemon left
 * running to report it, and a raw Node stack in the log where the cause
 * should have been. The bind supervisor's whole failed-bind path depends
 * on this rejection arriving.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { describe, expect, it } from 'vitest';
import { startOracleWsServer } from '../../src/host-runtime/ws-server';

setHostLogger({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });

const identity = { role: 'daemon' as const, nodeId: 'node-conflict', agent: 'bind-conflict-test' };
const PORT = 18231;

describe('startOracleWsServer on a taken port', () => {
  it('rejects with the address-in-use cause and leaves the holder serving', async () => {
    const holder = await startOracleWsServer({ host: '127.0.0.1', port: PORT, handshakeIdentity: identity });
    try {
      await expect(
        startOracleWsServer({ host: '127.0.0.1', port: PORT, handshakeIdentity: identity }),
      ).rejects.toMatchObject({ code: 'EADDRINUSE' });
      // The first server is untouched by the failed attempt.
      const res = await fetch(`http://127.0.0.1:${PORT}/healthz`);
      expect(res.status).toBe(400);
    } finally {
      await holder.close();
    }
  });
});
