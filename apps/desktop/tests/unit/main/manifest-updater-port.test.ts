import { describe, expect, it } from 'vitest';
import { createManifestUpdaterPort } from '../../../src/main/manifest-updater-port';
import type { UpdateChannel } from '../../../src/main/update-feed';

function makeFetch(body: unknown, options: { status?: number } = {}): { fetchFn: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return {
      ok: (options.status ?? 200) === 200,
      status: options.status ?? 200,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return { fetchFn, urls };
}

function makePort(
  currentVersion: string,
  body: unknown,
  options: { status?: number; channel?: UpdateChannel } = {},
): { port: ReturnType<typeof createManifestUpdaterPort>; urls: string[] } {
  const { fetchFn, urls } = makeFetch(body, options);
  return { port: createManifestUpdaterPort(currentVersion, () => options.channel ?? 'stable', fetchFn), urls };
}

describe('createManifestUpdaterPort', () => {
  it('offers the manifest latest when newer, with its release-notes URL', async () => {
    const { port, urls } = makePort('2026.8.2', { desktop: { latest: '2026.8.3', severity: 'normal' } });
    expect(await port.check()).toEqual({
      version: '2026.8.3',
      releaseNotesUrl: 'https://github.com/OpenHeaders/open-headers/releases/tag/v2026.8.3',
    });
    expect(urls).toEqual(['https://updates.openheaders.com/versions/stable.json']);
  });

  it('returns null when already on the latest or newer', async () => {
    const { port } = makePort('2026.8.3', { desktop: { latest: '2026.8.3', severity: 'normal' } });
    expect(await port.check()).toBeNull();
    const { port: ahead } = makePort('2026.9.0', { desktop: { latest: '2026.8.3', severity: 'normal' } });
    expect(await ahead.check()).toBeNull();
  });

  it('offers the plain release over a beta of the same base', async () => {
    const { port } = makePort('2026.8.3-beta.2', { desktop: { latest: '2026.8.3', severity: 'normal' } });
    expect((await port.check())?.version).toBe('2026.8.3');
  });

  it('reads the beta manifest on the beta channel', async () => {
    const { port, urls } = makePort(
      '2026.8.3',
      { desktop: { latest: '2026.8.4-beta.1', severity: 'normal' } },
      {
        channel: 'beta',
      },
    );
    expect((await port.check())?.version).toBe('2026.8.4-beta.1');
    expect(urls).toEqual(['https://updates.openheaders.com/versions/beta.json']);
  });

  it('throws on a non-200 feed response instead of reporting up to date', async () => {
    const { port } = makePort('2026.8.2', {}, { status: 503 });
    await expect(port.check()).rejects.toThrow('update feed returned 503');
  });

  it('throws on a manifest shape the generator could not have produced', async () => {
    const { port } = makePort('2026.8.2', { desktop: { latest: 'not-a-version', severity: 'normal' } });
    await expect(port.check()).rejects.toThrow('unreadable manifest');
  });

  it('download rejects — package-manager installs never download in-app', async () => {
    const { port } = makePort('2026.8.2', { desktop: { latest: '2026.8.3', severity: 'normal' } });
    await expect(port.download(() => {})).rejects.toThrow('never download');
  });
});
