/**
 * Default `(i)` popover content for the dial block's rows — title and
 * summary from the request-settings catalog (the one label vocabulary
 * every editor's block reads), kicker = the host group's label; the
 * Proxy row carries its modes glossary. An editor with an example card
 * composes this copy under its card (the diagram slot) — the copy is
 * the block's, the card the editor's.
 *
 * The dial leg is every card's one variant slot: proxy, Unix socket
 * and resolve-to-address are mutually exclusive ways to reach the
 * server, so one truthful card cannot carry all three at once — each
 * of those rows swaps the slot's text to its own leg and lights it,
 * every other row shows the `direct` default. `DIAL_LEG_TEXT` is that
 * vocabulary, shared so the legs read identically on every card.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export const DIAL_INFO_KEYS = ['resolveToAddress', 'proxy', 'proxyUrl', 'proxyCredentials'] as const;

export type DialInfoKey = (typeof DIAL_INFO_KEYS)[number];

export const isDialInfoKey = (key: string): key is DialInfoKey => (DIAL_INFO_KEYS as readonly string[]).includes(key);

/** The dial-slot text each dial-leg row substitutes for `direct` on
 *  its card. The mode row shows the INHERITED leg — what the
 *  environment plane supplies when the row stays on its default. The
 *  Unix socket row is each tab's own, on the same slot. */
export const DIAL_LEG_TEXT: Record<DialInfoKey | 'unixSocket', string> = {
  proxy: 'proxy corp.example:8080 (system)',
  proxyUrl: 'proxy 127.0.0.1:8080',
  proxyCredentials: 'proxy 127.0.0.1:8080 · auth: corp-proxy',
  resolveToAddress: 'dial 203.0.113.42',
  unixSocket: 'sock /var/run/docker.sock',
};

const TITLE_KEY: Record<DialInfoKey, MessageKey> = {
  resolveToAddress: 'workbench.editors.request.settings.resolveToAddress',
  proxy: 'workbench.editors.request.settings.proxy',
  proxyUrl: 'workbench.editors.request.settings.proxyUrl',
  proxyCredentials: 'workbench.editors.request.settings.proxyCredentials',
};

const SUMMARY_KEY: Record<Exclude<DialInfoKey, 'proxy'>, MessageKey> = {
  resolveToAddress: 'workbench.editors.request.settings.resolveToAddressInfo',
  proxyUrl: 'workbench.editors.request.settings.proxyUrlInfo',
  proxyCredentials: 'workbench.editors.request.settings.proxyCredentialsInfo',
};

/** The Proxy row's modes glossary — shared with the HTTP tab's rich
 *  popover so the three modes read identically everywhere. */
export function proxyModesSection(t: Translate): NonNullable<InfoPopoverContent['sections']>[number] {
  return {
    heading: t('workbench.editors.request.settings.proxyModesHeading'),
    layout: 'stacked',
    items: [
      {
        label: t('workbench.editors.request.settings.proxyModePlaceholder'),
        desc: t('workbench.editors.request.settings.proxyModeInheritDesc'),
      },
      {
        label: t('workbench.editors.request.settings.proxyModeDirect'),
        desc: t('workbench.editors.request.settings.proxyModeDirectDesc'),
      },
      {
        label: t('workbench.editors.request.settings.proxyModeCustom'),
        desc: t('workbench.editors.request.settings.proxyModeCustomDesc'),
      },
    ],
  };
}

export function dialRowInfo(t: Translate, key: DialInfoKey, kicker: string): InfoPopoverContent {
  const title = t(TITLE_KEY[key]);
  if (key === 'proxy') {
    return {
      title,
      kicker,
      summary: t('workbench.editors.request.settings.proxySummary'),
      description: t('workbench.editors.request.settings.proxyDescription'),
      sections: [proxyModesSection(t)],
    };
  }
  return { title, kicker, summary: t(SUMMARY_KEY[key]) };
}
