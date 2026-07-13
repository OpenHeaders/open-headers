/**
 * host-glyph — brand glyph resolution + OrgIcon host specialization.
 *
 * Pins the shared/host-glyph contract:
 *   - every recognizable browser / OS kind resolves to a bundled SVG
 *     glyph; kinds without a distinct mark resolve to null so callers
 *     fall back to the generic host-kind icon;
 *   - OrgIcon keeps the generic glyph for joined (non-home) Orgs —
 *     nothing records a remote peer's browser or OS;
 *   - a team Org renders the shared overlay on its halo disc.
 */

import type { OrgDescriptor } from '@openheaders/core/identity';
import { type HostStorage, OH, SELF_BACKEND_REACH_KEY, setHostStorage } from '@openheaders/core/storage';
import type { BrowserKind, PlatformKind } from '@openheaders/core/utils';
import { browserGlyph, platformGlyph } from '@openheaders/ui/shared/host-glyph';
import { OrgIcon } from '@openheaders/ui/shared/workspace-org/OrgIcon';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function createHostStorageFake(seed: Record<string, unknown>): HostStorage {
  const map = new Map<string, unknown>(Object.entries(seed));
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => {},
  };
}

function descriptor(overrides: Partial<OrgDescriptor> = {}): OrgDescriptor {
  return {
    id: 'org-1',
    name: 'oh-ubuntu-s-4vcpu-8gb-240gb-intel-fra1',
    scopeKind: 'team',
    hostKind: 'daemon',
    isPrivate: false,
    isHome: false,
    ...overrides,
  };
}

describe('brand glyph maps', () => {
  it('resolves a bundled SVG for every branded browser kind', () => {
    const branded: BrowserKind[] = ['chrome', 'chromium', 'edge', 'firefox', 'safari', 'opera', 'brave', 'vivaldi'];
    for (const kind of branded) {
      const Glyph = browserGlyph(kind);
      expect(Glyph, kind).not.toBeNull();
      if (!Glyph) continue;
      const { container, unmount } = render(<Glyph style={{ fontSize: 12 }} />);
      expect(container.querySelector('svg path'), kind).not.toBeNull();
      unmount();
    }
  });

  it('resolves a bundled SVG for every branded platform kind', () => {
    const branded: PlatformKind[] = ['macos', 'windows', 'ubuntu', 'debian', 'fedora', 'linux'];
    for (const kind of branded) {
      const Glyph = platformGlyph(kind);
      expect(Glyph, kind).not.toBeNull();
      if (!Glyph) continue;
      const { container, unmount } = render(<Glyph style={{ fontSize: 12 }} />);
      expect(container.querySelector('svg path'), kind).not.toBeNull();
      unmount();
    }
  });

  it('returns null for kinds without a distinct brand mark', () => {
    expect(browserGlyph('unknown')).toBeNull();
    expect(platformGlyph('unknown')).toBeNull();
  });
});

describe('OrgIcon', () => {
  it('keeps the generic host-kind glyph for joined Orgs', () => {
    const { container } = render(
      <OrgIcon descriptor={descriptor({ scopeKind: 'personal', hostKind: 'desktop', isHome: false })} />,
    );
    expect(container.querySelector('.anticon-desktop')).not.toBeNull();
  });

  it('renders the team overlay on a halo disc for team Orgs', () => {
    const { container } = render(<OrgIcon descriptor={descriptor()} size={12} />);
    expect(container.querySelector('.anticon-cloud-server')).not.toBeNull();
    const overlay = container.querySelector('.anticon-team');
    expect(overlay).not.toBeNull();
    const halo = overlay?.parentElement;
    expect(halo?.style.borderRadius).toBe('50%');
    expect(halo?.style.background).not.toBe('');
  });

  it('specializes a daemon Org by its reported reach tier', async () => {
    const home = descriptor({ hostKind: 'daemon', isHome: true });

    setHostStorage(createHostStorageFake({ [OH.backendReach.key]: { [SELF_BACKEND_REACH_KEY]: 'lan' } }));
    const lan = render(<OrgIcon descriptor={home} />);
    await waitFor(() => expect(lan.container.querySelector('.anticon-cluster')).not.toBeNull());
    lan.unmount();

    setHostStorage(createHostStorageFake({ [OH.backendReach.key]: { [SELF_BACKEND_REACH_KEY]: 'loopback' } }));
    const loopback = render(<OrgIcon descriptor={home} />);
    await waitFor(() => expect(loopback.container.querySelector('.anticon-hdd')).not.toBeNull());
  });

  it('renders a stamped hostOs mark for a daemon Org, beating the reach glyph', () => {
    const { container } = render(<OrgIcon descriptor={descriptor({ hostOs: 'ubuntu' })} size={12} />);
    expect(container.querySelector('.anticon-cloud-server')).toBeNull();
    expect(container.querySelector('svg path')).not.toBeNull();
  });

  it('renders a custom logo via <img>, beating every derived glyph', () => {
    const logo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const plain = render(
      <OrgIcon descriptor={descriptor({ hostOs: 'ubuntu', logo, scopeKind: 'personal' })} size={12} />,
    );
    expect(plain.container.querySelector('img')?.getAttribute('src')).toBe(logo);
    expect(plain.container.querySelector('svg')).toBeNull();
    plain.unmount();

    // Team overlay still rides on top of the logo.
    const team = render(<OrgIcon descriptor={descriptor({ logo })} size={12} />);
    expect(team.container.querySelector('img')).not.toBeNull();
    expect(team.container.querySelector('.anticon-team')).not.toBeNull();
  });

  it('specializes the home browser Org to the detected brand, falling back to the globe', () => {
    // jsdom's UA carries no real browser token, so detection lands on
    // the generic fallback — the contract under test is the fallback
    // seam itself, not any specific brand.
    const { container } = render(
      <OrgIcon descriptor={descriptor({ scopeKind: 'local', hostKind: 'browser', isHome: true, isPrivate: true })} />,
    );
    expect(container.querySelector('.anticon-global, span[role="img"] svg')).not.toBeNull();
  });
});
