/**
 * orgPlaceText — the place an Org reads as in the switcher's group
 * headers, the Sync page's placement row and Manage workspaces (the
 * Backup and Sync UX plan D3): the home Org by its hint alone, a joined
 * Org by its providing backend's place. Pins the English wording per
 * case.
 */

import type { OrgDescriptor } from '@openheaders/core/identity';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { orgPlaceText } from '@openheaders/ui/shared/workspace-org/org-copy';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

function makeDescriptor(overrides: Partial<OrgDescriptor> = {}): OrgDescriptor {
  return {
    id: 'org-acme',
    name: 'Acme',
    scopeKind: 'team',
    hostKind: 'daemon',
    isPrivate: false,
    isHome: false,
    ...overrides,
  };
}

const joinedDesktop = makeDescriptor({ id: 'org-mac', name: 'my-mac', scopeKind: 'personal', hostKind: 'desktop' });

describe('orgPlaceText', () => {
  it('the home Org reads by its hint alone — its name lives on the identity card', () => {
    const browserHome = makeDescriptor({
      name: 'Chrome',
      scopeKind: 'local',
      hostKind: 'browser',
      isPrivate: true,
      isHome: true,
    });
    const desktopHome = makeDescriptor({
      name: 'my-mac',
      scopeKind: 'local',
      hostKind: 'desktop',
      isPrivate: true,
      isHome: true,
    });
    expect(orgPlaceText(t, browserHome, null, null)).toBe('This browser');
    expect(orgPlaceText(t, desktopHome, null, null)).toBe('This computer');
  });

  it('a joined desktop app is this computer, or its label when the record carries one', () => {
    expect(orgPlaceText(t, joinedDesktop, null, { kind: 'desktop-app', name: null })).toBe(
      'This computer · desktop app',
    );
    expect(orgPlaceText(t, joinedDesktop, null, { kind: 'desktop-app', name: 'My Mac' })).toBe('My Mac · desktop app');
  });

  it('a joined server reads by its place name, the Org name when the place has none', () => {
    expect(orgPlaceText(t, makeDescriptor(), null, { kind: 'server', name: 'Daemon A' })).toBe('Daemon A · server');
    expect(orgPlaceText(t, makeDescriptor(), null, { kind: 'server', name: null })).toBe('Acme · server');
  });

  it('a joined Org without a place reads by its stored name', () => {
    expect(orgPlaceText(t, makeDescriptor(), null, null)).toBe('Acme');
  });
});
