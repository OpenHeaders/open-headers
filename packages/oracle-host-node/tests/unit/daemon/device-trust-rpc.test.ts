/**
 * The `oh.deviceTrust.*` routes: list / add / remove over the oracle
 * store with the change broadcast, the certificate gate on add, and
 * the presented-chain probe against a live private-CA server.
 */

import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import { createServer as createTlsServer, type Server as TlsServer } from 'node:tls';
import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { setHostStorage } from '@openheaders/core/storage';
import { __resetDeviceTrustForTests, loadDeviceTrust } from '@openheaders/oracle/entity/device-trust-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDeviceTrustRpc, isDeviceTrustRpc } from '../../../src/daemon/device-trust-rpc';
import { mintLeafCertificate, mintProxyCa } from '../../../src/daemon/proxy/ca-store';
import { createHostStorageFake } from '../_host-storage-fake';

const broadcast = vi.fn();
const bridge: HostBridge = {
  call: () => Promise.reject(new Error('unused')),
  broadcast: (...args: unknown[]) => broadcast(...args),
  subscribe: () => () => {},
  presence: () => () => {},
};

const servers: TlsServer[] = [];

function keyPem(pkcs8B64: string): string {
  const body = pkcs8B64.match(/.{1,64}/g)?.join('\n') ?? pkcs8B64;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

beforeEach(async () => {
  setHostStorage(createHostStorageFake());
  setHostBridge(bridge);
  broadcast.mockReset();
  __resetDeviceTrustForTests();
  await loadDeviceTrust();
});

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe('device-trust rpc', () => {
  it('routes only its own family', () => {
    expect(isDeviceTrustRpc('oh.deviceTrust.list')).toBe(true);
    expect(isDeviceTrustRpc('executeRequest')).toBe(false);
    expect(isDeviceTrustRpc(42)).toBe(false);
  });

  it('adds a parseable certificate (name defaults to the subject), lists it, removes it — broadcasting each change', async () => {
    const ca = await mintProxyCa();
    const added = (await handleDeviceTrustRpc('oh.deviceTrust.add', {
      certPem: ca.certPem,
      name: '',
      origin: '127.0.0.1:3443',
    })) as {
      ok: boolean;
      certificate?: { uid: string; name: string; origin?: string };
    };
    expect(added.ok).toBe(true);
    expect(added.certificate?.name).toContain('CN=');
    expect(added.certificate?.origin).toBe('127.0.0.1:3443');
    expect(broadcast).toHaveBeenCalledWith('deviceTrustChanged', { count: 1 });

    const listed = (await handleDeviceTrustRpc('oh.deviceTrust.list', {})) as { certificates: unknown[] };
    expect(listed.certificates).toHaveLength(1);

    const removed = await handleDeviceTrustRpc('oh.deviceTrust.remove', { uid: added.certificate?.uid });
    expect(removed).toEqual({ ok: true });
    expect(broadcast).toHaveBeenLastCalledWith('deviceTrustChanged', { count: 0 });
    expect(await handleDeviceTrustRpc('oh.deviceTrust.remove', { uid: 'nope' })).toMatchObject({ ok: false });
  });

  it('refuses material that is not a certificate and a duplicate pin', async () => {
    expect(await handleDeviceTrustRpc('oh.deviceTrust.add', { certPem: 'garbage', name: 'x' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('Not a certificate'),
    });
    const ca = await mintProxyCa();
    await handleDeviceTrustRpc('oh.deviceTrust.add', { certPem: ca.certPem, name: 'a' });
    expect(await handleDeviceTrustRpc('oh.deviceTrust.add', { certPem: ca.certPem, name: 'b' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('already trusted'),
    });
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('probes a live server for its presented chain and validates its input', async () => {
    const ca = await mintProxyCa();
    const leaf = await mintLeafCertificate(ca, ['127.0.0.1']);
    const server = createTlsServer(
      { key: keyPem(leaf.privateKeyPkcs8B64), cert: `${leaf.certPem.trim()}\n${ca.certPem.trim()}\n` },
      (socket) => socket.end(),
    );
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    const probed = (await handleDeviceTrustRpc('oh.deviceTrust.probe', { host: '127.0.0.1', port })) as {
      ok: boolean;
      chain?: Array<{ selfSigned: boolean }>;
    };
    expect(probed.ok).toBe(true);
    expect(probed.chain?.map((link) => link.selfSigned)).toEqual([false, true]);
    expect(await handleDeviceTrustRpc('oh.deviceTrust.probe', { host: '', port })).toMatchObject({ ok: false });
    expect(await handleDeviceTrustRpc('oh.deviceTrust.probe', { host: '127.0.0.1', port: 0 })).toMatchObject({
      ok: false,
    });
    expect(await handleDeviceTrustRpc('oh.deviceTrust.nope', {})).toBeUndefined();
  });
});
