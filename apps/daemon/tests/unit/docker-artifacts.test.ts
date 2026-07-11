/**
 * Drift gates for the container artifacts (`docker/`) — text-level
 * assertions pinning them to the surfaces they reference: every
 * `OH_DAEMON_*` env they set must be one `src/config.ts` actually
 * reads, ports must match the protocol constant, and the compose
 * example must keep the ops-doc posture (proxy-only entry, trusted
 * proxy asserted alongside the network bind). Building and running the
 * image is a local `docker build` verification, not a CI concern.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WS_PORT } from '@openheaders/core/protocol';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(packageRoot, ...parts), 'utf8');

const dockerfile = read('docker', 'Dockerfile');
const compose = read('docker', 'docker-compose.yml');
const caddyfile = read('docker', 'Caddyfile');
const configSource = read('src', 'config.ts');

function envNames(text: string): string[] {
  return [...new Set([...text.matchAll(/OH_DAEMON_[A-Z_]+/g)].map((m) => m[0]))];
}

describe('docker artifacts', () => {
  it('reference only env vars the daemon config actually reads', () => {
    const known = new Set(envNames(configSource));
    for (const name of [...envNames(dockerfile), ...envNames(compose)]) {
      expect(known, `${name} is not read by src/config.ts`).toContain(name);
    }
  });

  it('agree with the protocol port everywhere it appears', () => {
    expect(dockerfile).toContain(`EXPOSE ${WS_PORT}`);
    expect(dockerfile).toContain(`?? ${WS_PORT}}/healthz`);
    expect(caddyfile).toContain(`reverse_proxy daemon:${WS_PORT}`);
  });

  it('stage the image through the verified npm pack', () => {
    expect(dockerfile).toContain('scripts/pack.mjs');
    expect(dockerfile).toContain('dist-package/dist');
    expect(dockerfile).toContain('dist-package/node_modules');
  });

  it('point the daemon at the /data volume in both artifacts', () => {
    expect(dockerfile).toContain('OH_DAEMON_DATA_DIR=/data');
    expect(dockerfile).toContain('VOLUME /data');
    expect(compose).toContain('oh-daemon-data:/data');
  });

  it('keep the ops-doc proxy posture: network bind only with trustedProxy, no published daemon ports', () => {
    expect(compose).toContain('OH_DAEMON_BIND_ADDRESS: 0.0.0.0');
    expect(compose).toContain("OH_DAEMON_TRUSTED_PROXY: '1'");
    const daemonService = compose.slice(compose.indexOf('  daemon:'), compose.indexOf('  caddy:'));
    expect(daemonService).not.toContain('ports:');
  });

  it('front the daemon with the compose-local Caddyfile', () => {
    expect(compose).toContain('./Caddyfile:/etc/caddy/Caddyfile:ro');
    expect(caddyfile).toContain('{$OH_DOMAIN:localhost}');
  });
});
