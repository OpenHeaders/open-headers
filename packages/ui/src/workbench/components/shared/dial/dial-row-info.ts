/**
 * Default `(i)` popover content for the dial block's rows — title and
 * summary from the request-settings catalog (the one label vocabulary
 * every editor's block reads), kicker = the host group's label; the
 * Proxy row carries its modes glossary. An editor with richer copy
 * (the HTTP tab's example card) hands the block its own `rowInfo` and
 * falls back here for the keys it does not cover.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type DialInfoKey = 'resolveToAddress' | 'proxy' | 'proxyUrl' | 'proxyCredentials';

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
