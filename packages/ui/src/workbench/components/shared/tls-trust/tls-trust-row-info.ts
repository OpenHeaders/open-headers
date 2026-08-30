/**
 * Default `(i)` popover content for the TLS & trust block's rows —
 * title, summary, description and glossary from the request-settings
 * catalog (the one label vocabulary every editor's block reads),
 * kicker = the host group's label. The version rows explain the same
 * version vocabulary, the cipher row its list format, the verification
 * row what switching it off reaches. An editor with an example card
 * composes this copy under its card (the diagram slot) — the copy is
 * the block's, the card the editor's.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent, InfoPopoverSection } from '@openheaders/ui/shared/info-popover';

export const TLS_TRUST_INFO_KEYS = [
  'sslVerification',
  'clientCertificate',
  'tlsMin',
  'tlsMax',
  'tlsCipherSuites',
  'sni',
] as const;

export type TlsTrustInfoKey = (typeof TLS_TRUST_INFO_KEYS)[number];

export const isTlsTrustInfoKey = (key: string): key is TlsTrustInfoKey =>
  (TLS_TRUST_INFO_KEYS as readonly string[]).includes(key);

const TITLE_KEY: Record<TlsTrustInfoKey, MessageKey> = {
  sslVerification: 'workbench.editors.request.settings.sslVerification',
  clientCertificate: 'workbench.editors.request.settings.clientCertificate',
  tlsMin: 'workbench.editors.request.settings.tlsMin',
  tlsMax: 'workbench.editors.request.settings.tlsMax',
  tlsCipherSuites: 'workbench.editors.request.settings.tlsCipherSuites',
  sni: 'workbench.editors.request.settings.sni',
};

const SUMMARY_KEY: Record<TlsTrustInfoKey, MessageKey> = {
  sslVerification: 'workbench.editors.request.settings.sslVerificationSummary',
  clientCertificate: 'workbench.editors.request.settings.clientCertificateInfo',
  tlsMin: 'workbench.editors.request.settings.tlsMinSummary',
  tlsMax: 'workbench.editors.request.settings.tlsMaxSummary',
  tlsCipherSuites: 'workbench.editors.request.settings.tlsCipherSuitesSummary',
  sni: 'workbench.editors.request.settings.sniInfo',
};

/** The min and max rows explain the same version vocabulary. */
function tlsVersionsSection(t: Translate): InfoPopoverSection {
  return {
    heading: t('workbench.editors.request.settings.tlsVersionsHeading'),
    items: [
      { label: '1.0 / 1.1', desc: t('workbench.editors.request.settings.tlsVersionLegacyDesc') },
      { label: '1.2', desc: t('workbench.editors.request.settings.tlsVersion12Desc') },
      { label: '1.3', desc: t('workbench.editors.request.settings.tlsVersion13Desc') },
    ],
  };
}

function tlsCipherSuitesFormatSection(t: Translate): InfoPopoverSection {
  return {
    heading: t('workbench.editors.request.settings.tlsCipherSuitesFormatHeading'),
    layout: 'stacked',
    items: [
      { label: 'TLS_AES_128_GCM_SHA256', desc: t('workbench.editors.request.settings.tlsCipherSuitesIanaDesc') },
      {
        label: 'ECDHE-RSA-AES128-GCM-SHA256',
        desc: t('workbench.editors.request.settings.tlsCipherSuitesOpensslDesc'),
      },
      { label: ':', desc: t('workbench.editors.request.settings.tlsCipherSuitesJoinDesc') },
    ],
  };
}

export function tlsTrustRowInfo(t: Translate, key: TlsTrustInfoKey, kicker: string): InfoPopoverContent {
  const base = { title: t(TITLE_KEY[key]), kicker, summary: t(SUMMARY_KEY[key]) };
  switch (key) {
    case 'sslVerification':
      return { ...base, description: t('workbench.editors.request.settings.sslVerificationDescription') };
    case 'tlsMin':
      return {
        ...base,
        description: t('workbench.editors.request.settings.tlsMinDescription'),
        sections: [tlsVersionsSection(t)],
      };
    case 'tlsMax':
      return {
        ...base,
        description: t('workbench.editors.request.settings.tlsMaxDescription'),
        sections: [tlsVersionsSection(t)],
      };
    case 'tlsCipherSuites':
      return {
        ...base,
        description: t('workbench.editors.request.settings.tlsCipherSuitesDescription'),
        sections: [tlsCipherSuitesFormatSection(t)],
      };
    default:
      return base;
  }
}
