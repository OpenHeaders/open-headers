/**
 * Backend tier registry — the per-mode content the tier card renders:
 * title/badge/icon, capability bullets (carried vs new-in-tier),
 * supported platforms, and the connectivity footer with its expandable
 * address-range categories.
 *
 * Copy fields carry `MessageKey`s (single consumer, converted outright);
 * technical literals stay raw: IP ranges / URL patterns (`range`, `url`)
 * and platform proper nouns (`PlatformItem` uses the raw-or-key pair so
 * Chrome / macOS / AWS stay literal while generic items key).
 */

import type { MessageKey } from '@openheaders/i18n';
import type { BackendMode } from '../schema/backend';
import type { LabeledText } from '../types';

export type Icon = 'browser' | 'desktop' | 'daemon' | 'vm';
export type Bullet = { textKey: MessageKey; status: 'carried' | 'new' };
export type PlatformItem = LabeledText & { noteKey?: MessageKey };
export type PlatformGroup = { labelKey?: MessageKey; items: PlatformItem[] };

export type FooterCategory = { labelKey: MessageKey; items: { range: string; noteKey?: MessageKey }[] };
export type FooterInfo = {
  kind: 'cloud' | 'local';
  labelKey: MessageKey;
  url: string;
  categories?: FooterCategory[];
};

export type TierDef = {
  titleKey: MessageKey;
  subKey: MessageKey;
  badge: 'TODAY' | 'ROADMAP';
  icon: Icon;
  /** Tier this one builds on — resolved to its title in the card caption. */
  inheritsFrom?: BackendMode;
  bullets: Bullet[];
  platforms: PlatformGroup[];
  footer?: FooterInfo;
};

export const TIERS: Partial<Record<BackendMode, TierDef>> = {
  'in-browser': {
    titleKey: 'workbench.settings.backendPane.tier.in-browser.title',
    subKey: 'workbench.settings.backendPane.tier.in-browser.sub',
    badge: 'TODAY',
    icon: 'browser',
    bullets: [
      { textKey: 'workbench.settings.backendPane.tier.bullet.zeroSetup', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.singleDevice', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.perBrowserInstance', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiWindowEditing', status: 'new' },
    ],
    platforms: [
      {
        items: [
          { label: 'Chrome' },
          { label: 'Firefox' },
          { label: 'Edge' },
          { label: 'Safari', noteKey: 'workbench.settings.backendPane.tier.note.soon' },
        ],
      },
    ],
    footer: {
      kind: 'cloud',
      labelKey: 'workbench.settings.backendPane.tier.reach.none',
      url: '(in-process — no clients)',
      categories: [
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.whyNoWire',
          items: [
            {
              range: 'The back-end IS the browser service worker',
              noteKey: 'workbench.settings.backendPane.tier.rangeNote.backendIsSw',
            },
          ],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.sameBrowserSurfaces',
          items: [
            {
              range: 'browser.runtime messaging',
              noteKey: 'workbench.settings.backendPane.tier.rangeNote.runtimeMessaging',
            },
          ],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.perBrowserInstance',
          items: [
            {
              range: 'browser.storage.local',
              noteKey: 'workbench.settings.backendPane.tier.rangeNote.storageLocal',
            },
          ],
        },
      ],
    },
  },
  'desktop-app': {
    titleKey: 'workbench.settings.backendPane.tier.desktop-app.title',
    subKey: 'workbench.settings.backendPane.tier.desktop-app.sub',
    badge: 'TODAY',
    icon: 'desktop',
    inheritsFrom: 'in-browser',
    bullets: [
      { textKey: 'workbench.settings.backendPane.tier.bullet.zeroSetup', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.singleDevice', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiWindowEditing', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.localhostOnly', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiBrowserInstances', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.perAppInstance', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.nativeFilesystem', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.yamlOnDisk', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.gitIntegration', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.clients', status: 'new' },
    ],
    platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
    footer: {
      kind: 'cloud',
      labelKey: 'workbench.settings.backendPane.tier.reach.localhost',
      url: 'ws://localhost:<port>',
      categories: [
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.ipv4Loopback',
          items: [{ range: '127.0.0.0/8', noteKey: 'workbench.settings.backendPane.tier.rangeNote.typicalLoopback' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.ipv6Loopback',
          items: [{ range: '::1/128' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.defaultPort',
          items: [{ range: '8137', noteKey: 'workbench.settings.backendPane.tier.rangeNote.portOverride' }],
        },
      ],
    },
  },
  'local-self-hosted': {
    titleKey: 'workbench.settings.backendPane.tier.local-self-hosted.title',
    subKey: 'workbench.settings.backendPane.tier.local-self-hosted.sub',
    badge: 'ROADMAP',
    icon: 'daemon',
    inheritsFrom: 'desktop-app',
    bullets: [
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiBrowserInstances', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiWindowEditing', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.nativeFilesystem', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.yamlOnDisk', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.gitIntegration', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.clients', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.minimalSetup', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.localhostSupported', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.lanReachable', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiAppInstances', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multipleDevices', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.headlessByDefault', status: 'new' },
    ],
    platforms: [
      {
        labelKey: 'workbench.settings.backendPane.tier.group.allOs',
        items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }],
      },
      {
        labelKey: 'workbench.settings.backendPane.tier.group.embedded',
        items: [
          { label: 'Raspberry Pi' },
          { label: 'NAS' },
          { labelKey: 'workbench.settings.backendPane.tier.platform.miniPc' },
          { labelKey: 'workbench.settings.backendPane.tier.platform.homeServer' },
          { labelKey: 'workbench.settings.backendPane.tier.platform.oldLaptop' },
        ],
      },
    ],
    footer: {
      kind: 'cloud',
      labelKey: 'workbench.settings.backendPane.tier.reach.lan',
      url: 'ws://<lan-host>:<port>',
      categories: [
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.localhostLoopback',
          items: [
            { range: '127.0.0.0/8', noteKey: 'workbench.settings.backendPane.tier.rangeNote.daemonOwnBox' },
            { range: '::1/128', noteKey: 'workbench.settings.backendPane.tier.rangeNote.ipv6' },
          ],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.rfc1918',
          items: [{ range: '10.0.0.0/8' }, { range: '172.16.0.0/12' }, { range: '192.168.0.0/16' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.ipv6Ula',
          items: [{ range: 'fc00::/7', noteKey: 'workbench.settings.backendPane.tier.rangeNote.ulaPractically' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.cgnat',
          items: [{ range: '100.64.0.0/10', noteKey: 'workbench.settings.backendPane.tier.rangeNote.overlayVendors' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.zeroConfig',
          items: [
            { range: '169.254.0.0/16', noteKey: 'workbench.settings.backendPane.tier.rangeNote.ipv4LinkLocal' },
            { range: 'fe80::/10', noteKey: 'workbench.settings.backendPane.tier.rangeNote.ipv6LinkLocal' },
          ],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.mdns',
          items: [{ range: '*.local', noteKey: 'workbench.settings.backendPane.tier.rangeNote.bonjour' }],
        },
      ],
    },
  },
  'remote-self-hosted': {
    titleKey: 'workbench.settings.backendPane.tier.remote-self-hosted.title',
    subKey: 'workbench.settings.backendPane.tier.remote-self-hosted.sub',
    badge: 'ROADMAP',
    icon: 'vm',
    inheritsFrom: 'local-self-hosted',
    bullets: [
      { textKey: 'workbench.settings.backendPane.tier.bullet.multipleDevices', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiBrowserInstances', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiAppInstances', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.multiWindowEditing', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.nativeFilesystem', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.yamlOnDisk', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.gitIntegration', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.clients', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.localhostSupported', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.lanReachable', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.headlessByDefault', status: 'carried' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.standardSetup', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.wanReachable', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.teamReady', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.ssoAuth', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.rbac', status: 'new' },
      { textKey: 'workbench.settings.backendPane.tier.bullet.auditLogs', status: 'new' },
    ],
    platforms: [
      {
        labelKey: 'workbench.settings.backendPane.tier.group.hyperscalers',
        items: [{ label: 'AWS' }, { label: 'Azure' }, { label: 'Google Cloud' }],
      },
      {
        labelKey: 'workbench.settings.backendPane.tier.group.euNative',
        items: [{ label: 'Scaleway' }, { label: 'OVHcloud' }, { label: 'Hetzner' }, { label: 'IONOS' }],
      },
      {
        labelKey: 'workbench.settings.backendPane.tier.group.other',
        items: [{ label: 'DigitalOcean' }, { label: 'Heroku' }],
      },
      {
        labelKey: 'workbench.settings.backendPane.tier.group.enterprise',
        items: [
          { labelKey: 'workbench.settings.backendPane.tier.platform.yourCloud' },
          { labelKey: 'workbench.settings.backendPane.tier.platform.onPrem' },
        ],
      },
    ],
    footer: {
      kind: 'cloud',
      labelKey: 'workbench.settings.backendPane.tier.reach.wan',
      url: 'wss://<your-host>',
      categories: [
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.publicDns',
          items: [{ range: 'oh.example.com', noteKey: 'workbench.settings.backendPane.tier.rangeNote.tlsCert' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.publicIpv4',
          items: [{ range: 'a.b.c.d', noteKey: 'workbench.settings.backendPane.tier.rangeNote.publicIpv4' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.publicIpv6',
          items: [{ range: '2000::/3', noteKey: 'workbench.settings.backendPane.tier.rangeNote.globallyRoutable' }],
        },
        {
          labelKey: 'workbench.settings.backendPane.tier.cat.transport',
          items: [{ range: 'wss:// (TLS)', noteKey: 'workbench.settings.backendPane.tier.rangeNote.tlsRequired' }],
        },
      ],
    },
  },
};
