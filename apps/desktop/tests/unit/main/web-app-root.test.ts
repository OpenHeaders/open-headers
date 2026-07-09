import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readServeWebApp, webAppRootCandidate } from '../../../src/main/web-app-root';

describe('webAppRootCandidate', () => {
  it('resolves the packaged extraResource dir', () => {
    const root = webAppRootCandidate({
      isPackaged: true,
      resourcesPath: '/Applications/OpenHeaders.app/Contents/Resources',
      appPath: '/Applications/OpenHeaders.app/Contents/Resources/app.asar',
    });
    expect(root).toBe(path.join('/Applications/OpenHeaders.app/Contents/Resources', 'web'));
  });

  it('resolves the monorepo sibling web dist in dev', () => {
    const root = webAppRootCandidate({
      isPackaged: false,
      resourcesPath: '/somewhere/electron/resources',
      appPath: '/repo/apps/desktop',
    });
    expect(root).toBe(path.resolve('/repo/apps/web/dist'));
  });
});

describe('readServeWebApp', () => {
  it('reads only an explicit true', () => {
    expect(readServeWebApp({ 'backend.serveWebApp': true })).toBe(true);
    expect(readServeWebApp({ 'backend.serveWebApp': false })).toBe(false);
    expect(readServeWebApp({ 'backend.serveWebApp': 'true' })).toBe(false);
    expect(readServeWebApp({})).toBe(false);
    expect(readServeWebApp(undefined)).toBe(false);
  });
});
