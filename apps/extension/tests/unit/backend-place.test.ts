/**
 * The place a joined backend reads as (the Backup and Sync UX plan D3):
 * the kind off core's rule, the name label-first — a server then by the
 * workspace group it provides, then its address's host; an unlabelled
 * desktop app carries no name, it IS this computer.
 */

import { backendPlace, urlHost } from '@openheaders/ui/shared/backend';
import { describe, expect, it } from 'vitest';

describe('backendPlace', () => {
  it("the label wins on every host; the kind stays the record's", () => {
    expect(backendPlace('extension', { label: ' Acme ', url: 'wss://acme.openheaders.io' }, ['Other'])).toEqual({
      kind: 'server',
      name: 'Acme',
    });
    expect(backendPlace('extension', { label: 'My Mac', url: 'ws://127.0.0.1:8137' }, [])).toEqual({
      kind: 'desktop-app',
      name: 'My Mac',
    });
  });

  it('an unlabelled loopback address from a browser host is the desktop app on this computer, nameless', () => {
    expect(backendPlace('extension', { label: '', url: 'ws://127.0.0.1:8137' }, ['my-mac'])).toEqual({
      kind: 'desktop-app',
      name: null,
    });
    expect(backendPlace('web', { label: '', url: 'ws://localhost:8137' }, [])).toEqual({
      kind: 'desktop-app',
      name: null,
    });
  });

  it('on the desktop host a loopback address is a server on this computer, named by its host', () => {
    expect(backendPlace('desktop', { label: '', url: 'ws://127.0.0.1:9137' }, [])).toEqual({
      kind: 'server',
      name: '127.0.0.1',
    });
  });

  it('a server is named by the workspace group it provides', () => {
    expect(backendPlace('extension', { label: '', url: 'wss://acme.openheaders.io' }, ['Acme'])).toEqual({
      kind: 'server',
      name: 'Acme',
    });
  });

  it('a nameless server falls back to its address host, the raw address when it does not parse', () => {
    expect(backendPlace('extension', { label: '', url: 'wss://acme.openheaders.io:8443' }, [])).toEqual({
      kind: 'server',
      name: 'acme.openheaders.io',
    });
    expect(urlHost('not a url')).toBe('not a url');
  });

  it("a backend present by construction — the web tab's serving daemon — is the server its group names", () => {
    expect(backendPlace('web', null, ['Acme'])).toEqual({ kind: 'server', name: 'Acme' });
    expect(backendPlace('web', null, [])).toEqual({ kind: 'server', name: null });
  });
});
