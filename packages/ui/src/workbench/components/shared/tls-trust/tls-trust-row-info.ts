/**
 * Default `(i)` popover content for the TLS & trust block's rows —
 * title and summary from the request-settings catalog (the one label
 * vocabulary every editor's block reads), kicker = the host group's
 * label. An editor with richer copy (the HTTP tab's example card, the
 * MQTT tab's session card) hands the block its own `rowInfo` and falls
 * back here for the keys it does not cover.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type TlsTrustInfoKey = 'sslVerification' | 'clientCertificate' | 'tlsMin' | 'tlsMax' | 'tlsCipherSuites' | 'sni';

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

export function tlsTrustRowInfo(t: Translate, key: TlsTrustInfoKey, kicker: string): InfoPopoverContent {
  return { title: t(TITLE_KEY[key]), kicker, summary: t(SUMMARY_KEY[key]) };
}
