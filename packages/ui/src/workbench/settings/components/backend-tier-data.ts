/**
 * Backend tier registry — the per-mode content the tier card renders:
 * title/badge/icon, capability bullets (carried vs new-in-tier),
 * supported platforms, and the connectivity footer with its expandable
 * address-range categories.
 */

import type { BackendMode } from '../schema/backend';

export type Icon = 'browser' | 'desktop' | 'daemon' | 'vm';
export type Bullet = { text: string; status: 'carried' | 'new' };
export type PlatformItem = { label: string; note?: string };
export type PlatformGroup = { label?: string; items: PlatformItem[] };

export type FooterCategory = { label: string; items: { range: string; note?: string }[] };
export type FooterInfo = {
  kind: 'cloud' | 'local';
  label: string;
  url: string;
  categories?: FooterCategory[];
};

export type TierDef = {
  title: string;
  sub: string;
  badge: 'TODAY' | 'ROADMAP';
  icon: Icon;
  inheritsFrom?: string;
  bullets: Bullet[];
  platforms: PlatformGroup[];
  footer?: FooterInfo;
};

export const TIERS: Partial<Record<BackendMode, TierDef>> = {
  'in-browser': {
    title: 'In-browser',
    sub: 'extension service worker',
    badge: 'TODAY',
    icon: 'browser',
    bullets: [
      { text: 'zero setup', status: 'new' },
      { text: 'single device', status: 'new' },
      { text: 'per-browser instance', status: 'new' },
      { text: 'multi-surface concurrent editing', status: 'new' },
      { text: 'multi-window concurrent editing', status: 'new' },
    ],
    platforms: [
      { items: [{ label: 'Chrome' }, { label: 'Firefox' }, { label: 'Edge' }, { label: 'Safari', note: 'soon' }] },
    ],
    footer: {
      kind: 'cloud',
      label: 'N/A',
      url: '(in-process — no clients)',
      categories: [
        {
          label: 'Why no wire?',
          items: [
            {
              range: 'The back-end IS the browser service worker',
              note: 'no port to listen on, no IPC surface exposed to other devices',
            },
          ],
        },
        {
          label: 'Same-browser surfaces',
          items: [
            {
              range: 'browser.runtime messaging',
              note: 'popup / workbench / DevTools / side-panel talk to the SW in-process',
            },
          ],
        },
        {
          label: 'Per-browser instance',
          items: [
            {
              range: 'browser.storage.local',
              note: 'Chrome ≠ Firefox ≠ Edge — separate data per browser, no cross-device, no cross-browser',
            },
          ],
        },
      ],
    },
  },
  'desktop-app': {
    title: 'Desktop app',
    sub: 'embedded server',
    badge: 'TODAY',
    icon: 'desktop',
    inheritsFrom: 'In-browser',
    bullets: [
      { text: 'zero setup', status: 'carried' },
      { text: 'single device', status: 'carried' },
      { text: 'multi-surface concurrent editing', status: 'carried' },
      { text: 'multi-window concurrent editing', status: 'carried' },
      { text: 'Localhost-only', status: 'new' },
      { text: 'multi-browser instances', status: 'new' },
      { text: 'per-app instance', status: 'new' },
      { text: 'native filesystem', status: 'new' },
      { text: 'YAML on disk', status: 'new' },
      { text: 'git integration (local/remote)', status: 'new' },
      { text: 'browser ext · desktop app · CLI', status: 'new' },
    ],
    platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
    footer: {
      kind: 'cloud',
      label: 'Localhost',
      url: 'ws://localhost:<port>',
      categories: [
        {
          label: 'IPv4 loopback',
          items: [{ range: '127.0.0.0/8', note: 'typically 127.0.0.1' }],
        },
        {
          label: 'IPv6 loopback',
          items: [{ range: '::1/128' }],
        },
        {
          label: 'Default port',
          items: [{ range: '8137', note: 'override in Backend → Connection' }],
        },
      ],
    },
  },
  'local-self-hosted': {
    title: 'Local server',
    sub: 'on your LAN',
    badge: 'ROADMAP',
    icon: 'daemon',
    inheritsFrom: 'Desktop app',
    bullets: [
      { text: 'multi-browser instances', status: 'carried' },
      { text: 'multi-surface concurrent editing', status: 'carried' },
      { text: 'multi-window concurrent editing', status: 'carried' },
      { text: 'native filesystem', status: 'carried' },
      { text: 'YAML on disk', status: 'carried' },
      { text: 'git integration (local/remote)', status: 'carried' },
      { text: 'browser ext · desktop app · CLI', status: 'carried' },
      { text: 'minimal setup', status: 'new' },
      { text: 'Localhost-supported', status: 'new' },
      { text: 'LAN-reachable', status: 'new' },
      { text: 'multi-app instances', status: 'new' },
      { text: 'multiple devices', status: 'new' },
      { text: 'headless by default · website opt-in', status: 'new' },
    ],
    platforms: [
      { label: 'All OS', items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] },
      {
        label: 'Embedded',
        items: [
          { label: 'Raspberry Pi' },
          { label: 'NAS' },
          { label: 'Mini PC' },
          { label: 'Home server' },
          { label: 'Old laptop' },
        ],
      },
    ],
    footer: {
      kind: 'cloud',
      label: 'Localhost/LAN',
      url: 'ws://<lan-host>:<port>',
      categories: [
        {
          label: 'Localhost / loopback',
          items: [
            { range: '127.0.0.0/8', note: 'IPv4 — daemon on your own box (Docker, sidecar)' },
            { range: '::1/128', note: 'IPv6' },
          ],
        },
        {
          label: 'RFC1918 private IPv4',
          items: [{ range: '10.0.0.0/8' }, { range: '172.16.0.0/12' }, { range: '192.168.0.0/16' }],
        },
        {
          label: 'IPv6 ULA',
          items: [{ range: 'fc00::/7', note: 'practically fd00::/8 — IPv6 private allocation' }],
        },
        {
          label: 'CGNAT / overlay',
          items: [{ range: '100.64.0.0/10', note: 'Tailscale, etc.' }],
        },
        {
          label: 'Zero-config / no-DHCP fallback',
          items: [
            { range: '169.254.0.0/16', note: 'IPv4 link-local (APIPA)' },
            { range: 'fe80::/10', note: 'IPv6 link-local — every interface auto-assigns one' },
          ],
        },
        {
          label: 'mDNS hostnames',
          items: [{ range: '*.local', note: 'Bonjour / Avahi' }],
        },
      ],
    },
  },
  'remote-self-hosted': {
    title: 'Remote server',
    sub: 'on the WAN',
    badge: 'ROADMAP',
    icon: 'vm',
    inheritsFrom: 'Local server',
    bullets: [
      { text: 'multiple devices', status: 'carried' },
      { text: 'multi-browser instances', status: 'carried' },
      { text: 'multi-app instances', status: 'carried' },
      { text: 'multi-surface concurrent editing', status: 'carried' },
      { text: 'multi-window concurrent editing', status: 'carried' },
      { text: 'native filesystem', status: 'carried' },
      { text: 'YAML on disk', status: 'carried' },
      { text: 'git integration (local/remote)', status: 'carried' },
      { text: 'browser ext · desktop app · CLI', status: 'carried' },
      { text: 'Localhost-supported', status: 'carried' },
      { text: 'LAN-reachable', status: 'carried' },
      { text: 'headless by default · website opt-in', status: 'carried' },
      { text: 'standard setup', status: 'new' },
      { text: 'WAN/Internet-reachable', status: 'new' },
      { text: 'team-ready', status: 'new' },
      { text: 'SSO Auth', status: 'new' },
      { text: 'RBAC user management', status: 'new' },
      { text: 'audit logs & reports', status: 'new' },
    ],
    platforms: [
      { label: 'Hyperscalers', items: [{ label: 'AWS' }, { label: 'Azure' }, { label: 'Google Cloud' }] },
      {
        label: 'EU-native',
        items: [{ label: 'Scaleway' }, { label: 'OVHcloud' }, { label: 'Hetzner' }, { label: 'IONOS' }],
      },
      { label: 'Other', items: [{ label: 'DigitalOcean' }, { label: 'Heroku' }] },
      { label: 'Enterprise', items: [{ label: 'Your cloud' }, { label: 'On-prem' }] },
    ],
    footer: {
      kind: 'cloud',
      label: 'Internet/WAN',
      url: 'wss://<your-host>',
      categories: [
        {
          label: 'Public DNS hostname',
          items: [{ range: 'oh.example.com', note: 'recommended — TLS cert' }],
        },
        {
          label: 'Public IPv4',
          items: [{ range: 'a.b.c.d', note: 'anything outside RFC1918 / 100.64/10' }],
        },
        {
          label: 'Public IPv6',
          items: [{ range: '2000::/3', note: 'globally routable' }],
        },
        {
          label: 'Transport',
          items: [{ range: 'wss:// (TLS)', note: 'required — clients refuse ws:// to a non-loopback host' }],
        },
      ],
    },
  },
};
