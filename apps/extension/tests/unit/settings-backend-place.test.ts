/**
 * The place a "Synced with" row names (the Backup and Sync UX plan D3):
 * the user's label first, a loopback address from a browser host is the
 * desktop app, a server is its workspace group's name, and only a
 * nameless server falls back to its address's host.
 */

import { backendPlace, urlHost } from '@openheaders/ui/workbench/settings/components/backend-place';
import { describe, expect, it } from 'vitest';

describe('backendPlace', () => {
  it('the label wins on every host', () => {
    expect(backendPlace('extension', { label: ' Acme ', url: 'ws://127.0.0.1:8137' }, ['Other'])).toEqual({
      kind: 'named',
      name: 'Acme',
    });
  });

  it('a loopback address from a browser host is the desktop app on this computer', () => {
    expect(backendPlace('extension', { label: '', url: 'ws://127.0.0.1:8137' }, [])).toEqual({ kind: 'desktop-app' });
    expect(backendPlace('web', { label: '', url: 'ws://localhost:8137' }, [])).toEqual({ kind: 'desktop-app' });
  });

  it('on the desktop host a loopback address is a server on this computer, named by its host', () => {
    expect(backendPlace('desktop', { label: '', url: 'ws://127.0.0.1:9137' }, [])).toEqual({
      kind: 'named',
      name: '127.0.0.1',
    });
  });

  it('a server is named by the workspace group it provides', () => {
    expect(backendPlace('extension', { label: '', url: 'wss://acme.openheaders.io' }, ['Acme'])).toEqual({
      kind: 'named',
      name: 'Acme',
    });
  });

  it('a nameless server falls back to its address host, the raw address when it does not parse', () => {
    expect(backendPlace('extension', { label: '', url: 'wss://acme.openheaders.io:8443' }, [])).toEqual({
      kind: 'named',
      name: 'acme.openheaders.io',
    });
    expect(urlHost('not a url')).toBe('not a url');
  });
});
