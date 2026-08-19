/**
 * `(i)` info-popover content for the request Settings tab — the
 * network table's `NetworkColumnInfo` idiom brought to the knobs:
 * kicker, title, the shared example card with the popover's slice lit,
 * then the popover's own copy. Rows light their single token; group
 * headers light their whole sub-slice of the same example, so the
 * group popovers partition the send the row popovers itemize.
 *
 * Every popover leads with the same canonical example send rendered as
 * a compact card; the row's own slice of that send is the highlighted
 * token, so reading across the rows builds one coherent picture of a
 * single send seen knob by knob. The example is a POST so the redirect
 * tokens can show the method rewrite the redirect trio governs.
 *
 * The dial leg is the one variant slot: proxy, Unix socket, and
 * resolve-to-address are mutually exclusive ways to reach the server
 * (the tab warns while two are set), so one truthful card cannot carry
 * all three at once — each of those rows swaps the slot's text to its
 * own leg and lights it, and every other row shows the `direct`
 * default. The body slot works the same way for the Body tab's
 * mutually-exclusive encodings: the canonical POST carries `body:
 * json`, and each Body-mode popover swaps the slot to its own wire
 * shape and lights it.
 *
 * Card tokens ride raw (wire vocabulary — the column-card precedent);
 * only the caption is localized.
 */

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent, InfoPopoverSection } from '@openheaders/ui/shared/info-popover';
import { GROUP_LABEL_KEY, type SettingsGroupKey } from './settings-groups';

/** One key per settings row that opens a popover with the card. */
export type SettingsInfoKey =
  | 'httpVersion'
  | 'resolveToAddress'
  | 'proxy'
  | 'proxyUrl'
  | 'proxyCredentials'
  | 'unixSocket'
  | 'sslVerification'
  | 'tlsMin'
  | 'tlsMax'
  | 'tlsCipherSuites'
  | 'clientCertificate'
  | 'followRedirects'
  | 'maxRedirects'
  | 'followOriginalMethod'
  | 'followAuthHeader'
  | 'sendBrowserCookies'
  | 'cookieJar'
  | 'timeout'
  | 'responseSizeLimit'
  | 'scriptMode';

/** The single send every row popover illustrates. Holding one example
 * fixed across all popovers lets the user map each knob onto the same
 * concrete send. */
const EX = {
  method: 'POST',
  url: 'https://api.openheaders.com/v1/users',
  body: 'body: json',
  protocol: 'h2',
  dial: 'direct',
  tlsWindow: 'TLS 1.2–1.3',
  verify: 'verify ✓',
  suite: 'TLS_AES_128_GCM_SHA256',
  cert: 'cert: acme-mtls',
  chain: '302 → 200',
  hops: '3 hops',
  methodRewrite: 'POST → GET',
  authDrop: 'auth: dropped',
  jar: 'jar: 3 cookies',
  time: '30 s',
  cap: '2 MB cap',
  scripts: 'scripts: safe',
} as const;

type TokenId = Exclude<keyof typeof EX, 'method'>;

/** Which token of the example each row lights up. The TLS window is
 * one token — min and max both light it, and their summaries name
 * their own end. The two cookie rows share the jar token: they are the
 * same slice on their respective runtimes. */
const HIGHLIGHT: Record<SettingsInfoKey, TokenId> = {
  httpVersion: 'protocol',
  resolveToAddress: 'dial',
  proxy: 'dial',
  proxyUrl: 'dial',
  proxyCredentials: 'dial',
  unixSocket: 'dial',
  sslVerification: 'verify',
  tlsMin: 'tlsWindow',
  tlsMax: 'tlsWindow',
  tlsCipherSuites: 'suite',
  clientCertificate: 'cert',
  followRedirects: 'chain',
  maxRedirects: 'hops',
  followOriginalMethod: 'methodRewrite',
  followAuthHeader: 'authDrop',
  sendBrowserCookies: 'jar',
  cookieJar: 'jar',
  timeout: 'time',
  responseSizeLimit: 'cap',
  scriptMode: 'scripts',
};

/** The dial-slot text each dial-leg row substitutes for `direct`. */
const DIAL_VARIANT: Partial<Record<SettingsInfoKey, string>> = {
  // The mode row's card shows the INHERITED leg — what the environment
  // plane supplies when the row stays on its default.
  proxy: 'proxy corp.example:8080 (system)',
  proxyUrl: 'proxy 127.0.0.1:8080',
  proxyCredentials: 'proxy 127.0.0.1:8080 · auth: corp-proxy',
  resolveToAddress: 'dial 203.0.113.42',
  unixSocket: 'sock /var/run/docker.sock',
};

/** Each group's sub-slice of the example — the union of its rows'
 * tokens, so the group popovers partition the card between them. */
const GROUP_TOKENS: Record<SettingsGroupKey, readonly TokenId[]> = {
  connection: ['protocol', 'dial'],
  tls: ['tlsWindow', 'verify', 'suite', 'cert'],
  redirects: ['chain', 'hops', 'methodRewrite', 'authDrop'],
  cookies: ['jar'],
  execution: ['time', 'cap', 'scripts'],
};

function SettingsExampleCard({
  lit,
  dialText,
  bodyText,
}: {
  lit: ReadonlySet<TokenId>;
  dialText?: string;
  bodyText?: string;
}) {
  const t = useT();
  const tok = (id: TokenId, text: string) => (
    <span className={`oh-info-eg-tok${lit.has(id) ? ' oh-info-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="oh-info-eg">
      <div className="oh-info-eg-cap">{t('workbench.editors.request.settings.exampleCaption')}</div>
      <div className="oh-info-eg-card">
        <div className="oh-info-eg-line">
          <span className="oh-info-eg-method">{EX.method}</span> {tok('url', EX.url)}
          {' · '}
          {tok('body', bodyText ?? EX.body)}
        </div>
        <div className="oh-info-eg-line">
          {tok('protocol', EX.protocol)}
          {' · '}
          {tok('dial', dialText ?? EX.dial)}
          {' · '}
          {tok('tlsWindow', EX.tlsWindow)}
          {' · '}
          {tok('verify', EX.verify)}
          {' · '}
          {tok('suite', EX.suite)}
          {' · '}
          {tok('cert', EX.cert)}
        </div>
        <div className="oh-info-eg-line">
          {tok('chain', EX.chain)}
          {' · '}
          {tok('hops', EX.hops)}
          {' · '}
          {tok('methodRewrite', EX.methodRewrite)}
          {' · '}
          {tok('authDrop', EX.authDrop)}
          {' · '}
          {tok('jar', EX.jar)}
          {' · '}
          {tok('time', EX.time)}
          {' · '}
          {tok('cap', EX.cap)}
          {' · '}
          {tok('scripts', EX.scripts)}
        </div>
      </div>
    </div>
  );
}

const TITLE_KEY: Record<SettingsInfoKey, MessageKey> = {
  httpVersion: 'workbench.editors.request.settings.httpVersion',
  resolveToAddress: 'workbench.editors.request.settings.resolveToAddress',
  proxy: 'workbench.editors.request.settings.proxy',
  proxyUrl: 'workbench.editors.request.settings.proxyUrl',
  proxyCredentials: 'workbench.editors.request.settings.proxyCredentials',
  unixSocket: 'workbench.editors.request.settings.unixSocket',
  sslVerification: 'workbench.editors.request.settings.sslVerification',
  tlsMin: 'workbench.editors.request.settings.tlsMin',
  tlsMax: 'workbench.editors.request.settings.tlsMax',
  tlsCipherSuites: 'workbench.editors.request.settings.tlsCipherSuites',
  clientCertificate: 'workbench.editors.request.settings.clientCertificate',
  followRedirects: 'workbench.editors.request.settings.followRedirects',
  maxRedirects: 'workbench.editors.request.settings.maxRedirects',
  followOriginalMethod: 'workbench.editors.request.settings.followOriginalMethod',
  followAuthHeader: 'workbench.editors.request.settings.followAuthHeader',
  sendBrowserCookies: 'workbench.editors.request.settings.sendBrowserCookies',
  cookieJar: 'workbench.editors.request.settings.cookieJar',
  timeout: 'workbench.editors.request.settings.timeout',
  responseSizeLimit: 'workbench.editors.request.settings.responseSizeLimit',
  scriptMode: 'workbench.editors.request.settings.scriptMode',
};

const GROUP_OF: Record<SettingsInfoKey, SettingsGroupKey> = {
  httpVersion: 'connection',
  resolveToAddress: 'connection',
  proxy: 'connection',
  proxyUrl: 'connection',
  proxyCredentials: 'connection',
  unixSocket: 'connection',
  sslVerification: 'tls',
  tlsMin: 'tls',
  tlsMax: 'tls',
  tlsCipherSuites: 'tls',
  clientCertificate: 'tls',
  followRedirects: 'redirects',
  maxRedirects: 'redirects',
  followOriginalMethod: 'redirects',
  followAuthHeader: 'redirects',
  sendBrowserCookies: 'cookies',
  cookieJar: 'cookies',
  timeout: 'execution',
  responseSizeLimit: 'execution',
  scriptMode: 'execution',
};

/** Rows whose copy is restructured into summary + description +
 * glossary section; every other row keeps its single `*Info` summary. */
type RichInfoKey = 'httpVersion' | 'proxy' | 'sslVerification' | 'tlsMin' | 'tlsMax' | 'tlsCipherSuites' | 'scriptMode';

const SUMMARY_KEY: Record<Exclude<SettingsInfoKey, RichInfoKey>, MessageKey> = {
  resolveToAddress: 'workbench.editors.request.settings.resolveToAddressInfo',
  proxyUrl: 'workbench.editors.request.settings.proxyUrlInfo',
  proxyCredentials: 'workbench.editors.request.settings.proxyCredentialsInfo',
  unixSocket: 'workbench.editors.request.settings.unixSocketInfo',
  clientCertificate: 'workbench.editors.request.settings.clientCertificateInfo',
  followRedirects: 'workbench.editors.request.settings.followRedirectsInfo',
  maxRedirects: 'workbench.editors.request.settings.maxRedirectsInfo',
  followOriginalMethod: 'workbench.editors.request.settings.followOriginalMethodInfo',
  followAuthHeader: 'workbench.editors.request.settings.followAuthHeaderInfo',
  sendBrowserCookies: 'workbench.editors.request.settings.sendBrowserCookiesInfo',
  cookieJar: 'workbench.editors.request.settings.cookieJarInfo',
  timeout: 'workbench.editors.request.settings.timeoutInfo',
  responseSizeLimit: 'workbench.editors.request.settings.responseSizeLimitInfo',
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

/** Tokens of the shared example — for callers (the runtime-managed
 * fact sheet) that map their own rows onto slices of the same send. */
export type SettingsExampleToken = TokenId;

/** The shared example card with an arbitrary slice lit — the fact
 * sheet's rows and the Body / Scripts tabs ride this so managed facts
 * and live knobs illustrate the same send. `bodyText` swaps the body
 * variant slot the way the dial rows swap the dial leg. */
export function settingsExampleCard(
  lit: readonly SettingsExampleToken[],
  opts?: { bodyText?: string },
): React.ReactElement {
  return <SettingsExampleCard lit={new Set(lit)} bodyText={opts?.bodyText} />;
}

const GROUP_SUMMARY_KEY: Record<SettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.request.settings.groupInfo.connection',
  tls: 'workbench.editors.request.settings.groupInfo.tls',
  redirects: 'workbench.editors.request.settings.groupInfo.redirects',
  cookies: 'workbench.editors.request.settings.groupInfo.cookies',
  execution: 'workbench.editors.request.settings.groupInfo.execution',
};

/** Popover content for a group header: the group's whole sub-slice of
 * the shared example lit at once. */
export function settingsGroupInfo(t: Translate, group: SettingsGroupKey): InfoPopoverContent {
  return {
    title: t(GROUP_LABEL_KEY[group]),
    kicker: t('workbench.editors.request.tab.settings'),
    diagram: <SettingsExampleCard lit={new Set(GROUP_TOKENS[group])} />,
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one settings row. */
export function settingsRowInfo(t: Translate, infoKey: SettingsInfoKey): InfoPopoverContent {
  const base = {
    title: t(TITLE_KEY[infoKey]),
    kicker: t(GROUP_LABEL_KEY[GROUP_OF[infoKey]]),
    diagram: <SettingsExampleCard lit={new Set([HIGHLIGHT[infoKey]])} dialText={DIAL_VARIANT[infoKey]} />,
  };
  switch (infoKey) {
    case 'httpVersion':
      return {
        ...base,
        summary: t('workbench.editors.request.settings.httpVersionSummary'),
        description: t('workbench.editors.request.settings.httpVersionDescription'),
        sections: [
          {
            heading: t('workbench.editors.request.settings.httpVersionValuesHeading'),
            layout: 'stacked',
            items: [
              { label: 'Auto', desc: t('workbench.editors.request.settings.httpVersionAutoDesc') },
              { label: 'HTTP/1.1', desc: t('workbench.editors.request.settings.httpVersion11Desc') },
              { label: 'HTTP/2', desc: t('workbench.editors.request.settings.httpVersion2Desc') },
              {
                label: t('workbench.editors.request.settings.httpVersionPriorKnowledge'),
                desc: t('workbench.editors.request.settings.httpVersionPkDesc'),
              },
              { label: 'HTTP/3', desc: t('workbench.editors.request.settings.httpVersion3Desc') },
            ],
          },
        ],
      };
    case 'proxy':
      return {
        ...base,
        summary: t('workbench.editors.request.settings.proxySummary'),
        description: t('workbench.editors.request.settings.proxyDescription'),
        sections: [
          {
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
          },
        ],
      };
    case 'sslVerification':
      return {
        ...base,
        summary: t('workbench.editors.request.settings.sslVerificationSummary'),
        description: t('workbench.editors.request.settings.sslVerificationDescription'),
      };
    case 'tlsMin':
      return {
        ...base,
        summary: t('workbench.editors.request.settings.tlsMinSummary'),
        description: t('workbench.editors.request.settings.tlsMinDescription'),
        sections: [tlsVersionsSection(t)],
      };
    case 'tlsMax':
      return {
        ...base,
        summary: t('workbench.editors.request.settings.tlsMaxSummary'),
        description: t('workbench.editors.request.settings.tlsMaxDescription'),
        sections: [tlsVersionsSection(t)],
      };
    case 'tlsCipherSuites':
      return {
        ...base,
        summary: t('workbench.editors.request.settings.tlsCipherSuitesSummary'),
        description: t('workbench.editors.request.settings.tlsCipherSuitesDescription'),
        sections: [
          {
            heading: t('workbench.editors.request.settings.tlsCipherSuitesFormatHeading'),
            layout: 'stacked',
            items: [
              {
                label: 'TLS_AES_128_GCM_SHA256',
                desc: t('workbench.editors.request.settings.tlsCipherSuitesIanaDesc'),
              },
              {
                label: 'ECDHE-RSA-AES128-GCM-SHA256',
                desc: t('workbench.editors.request.settings.tlsCipherSuitesOpensslDesc'),
              },
              { label: ':', desc: t('workbench.editors.request.settings.tlsCipherSuitesJoinDesc') },
            ],
          },
        ],
      };
    case 'scriptMode':
      return {
        ...base,
        summary: t('workbench.editors.request.settings.scriptModeSummary'),
        description: t('workbench.editors.request.settings.scriptModeDescription'),
        sections: [
          {
            heading: t('workbench.editors.request.settings.scriptModeModesHeading'),
            layout: 'stacked',
            items: [
              {
                label: t('workbench.editors.request.settings.scriptModeSafe'),
                desc: t('workbench.editors.request.settings.scriptModeSafeCard'),
              },
              {
                label: t('workbench.editors.request.settings.scriptModeDeveloper'),
                desc: t('workbench.editors.request.settings.scriptModeDeveloperCard'),
              },
            ],
          },
        ],
      };
    default:
      return { ...base, summary: t(SUMMARY_KEY[infoKey]) };
  }
}
