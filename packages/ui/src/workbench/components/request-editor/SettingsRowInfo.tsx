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
 * The dial leg is the one variant slot (the shared `DIAL_LEG_TEXT`
 * vocabulary): proxy, Unix socket, and resolve-to-address are mutually
 * exclusive ways to reach the server (the tab warns while two are
 * set), so one truthful card cannot carry all three at once — each of
 * those rows swaps the slot's text to its own leg and lights it, and
 * every other row shows the `direct` default. The body slot works the
 * same way for the Body tab's mutually-exclusive encodings: the
 * canonical POST carries `body: json`, and each Body-mode popover swaps
 * the slot to its own wire shape and lights it.
 *
 * The rows of the shared blocks (dial, TLS & trust) compose the
 * blocks' own copy — summary, description, glossary — under this
 * tab's card, so the copy reads identically on every editor and only
 * the card is the HTTP tab's. Card tokens ride raw (wire vocabulary —
 * the column-card precedent); only the caption is localized.
 */

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  EXAMPLE_CARD_POPOVER_WIDTH,
  ExampleCard,
  type ExampleCardLine,
  type InfoPopoverContent,
} from '@openheaders/ui/shared/info-popover';
import { DIAL_LEG_TEXT, type DialInfoKey, dialRowInfo, isDialInfoKey } from '../shared/dial/dial-row-info';
import { isTlsTrustInfoKey, type TlsTrustInfoKey, tlsTrustRowInfo } from '../shared/tls-trust/tls-trust-row-info';
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
  | 'sni'
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
  url: 'https://api.openheaders.com/v1/users',
  body: 'body: json',
  protocol: 'h2',
  dial: 'direct',
  tlsWindow: 'TLS 1.2–1.3',
  verify: 'verify ✓',
  suite: 'TLS_AES_128_GCM_SHA256',
  cert: 'cert: acme-mtls',
  sni: 'sni: api.openheaders.com',
  chain: '302 → 200',
  hops: '3 hops',
  methodRewrite: 'POST → GET',
  authDrop: 'auth: dropped',
  jar: 'jar: 3 cookies',
  time: '30 s',
  cap: '2 MB cap',
  scripts: 'scripts: safe',
} as const;

type TokenId = keyof typeof EX;

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
  sni: 'sni',
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

/** Rows that swap the dial slot to their own leg. */
const DIAL_VARIANT: Partial<Record<SettingsInfoKey, string>> = DIAL_LEG_TEXT;

/** Each group's sub-slice of the example — the union of its rows'
 * tokens, so the group popovers partition the card between them. */
const GROUP_TOKENS: Record<SettingsGroupKey, readonly TokenId[]> = {
  connection: ['protocol', 'dial'],
  tls: ['tlsWindow', 'verify', 'suite', 'cert', 'sni'],
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
  const tok = (id: TokenId, text: string = EX[id]) => ({ id, text });
  const lines: ExampleCardLine<TokenId>[] = [
    { opener: 'POST', tokens: [tok('url'), tok('body', bodyText)] },
    {
      tokens: [
        tok('protocol'),
        tok('dial', dialText),
        tok('tlsWindow'),
        tok('verify'),
        tok('suite'),
        tok('cert'),
        tok('sni'),
      ],
    },
    {
      tokens: [
        tok('chain'),
        tok('hops'),
        tok('methodRewrite'),
        tok('authDrop'),
        tok('jar'),
        tok('time'),
        tok('cap'),
        tok('scripts'),
      ],
    },
  ];
  return <ExampleCard caption={t('workbench.editors.request.settings.exampleCaption')} lines={lines} lit={lit} />;
}

/** The tab's own rows — the shared blocks' rows read their blocks'
 * titles. */
type OwnInfoKey = Exclude<SettingsInfoKey, DialInfoKey | TlsTrustInfoKey>;

const TITLE_KEY: Record<OwnInfoKey, MessageKey> = {
  httpVersion: 'workbench.editors.request.settings.httpVersion',
  unixSocket: 'workbench.editors.request.settings.unixSocket',
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
  sni: 'tls',
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
 * glossary section; every other own row keeps its single `*Info`
 * summary. */
type RichInfoKey = 'httpVersion' | 'scriptMode';

const SUMMARY_KEY: Record<Exclude<OwnInfoKey, RichInfoKey>, MessageKey> = {
  unixSocket: 'workbench.editors.request.settings.unixSocketInfo',
  followRedirects: 'workbench.editors.request.settings.followRedirectsInfo',
  maxRedirects: 'workbench.editors.request.settings.maxRedirectsInfo',
  followOriginalMethod: 'workbench.editors.request.settings.followOriginalMethodInfo',
  followAuthHeader: 'workbench.editors.request.settings.followAuthHeaderInfo',
  sendBrowserCookies: 'workbench.editors.request.settings.sendBrowserCookiesInfo',
  cookieJar: 'workbench.editors.request.settings.cookieJarInfo',
  timeout: 'workbench.editors.request.settings.timeoutInfo',
  responseSizeLimit: 'workbench.editors.request.settings.responseSizeLimitInfo',
};

/** Tokens of the shared example — for callers (the runtime-managed
 * fact sheet) that map their own rows onto slices of the same send. */
export type SettingsExampleToken = TokenId;

/** The shared example card with an arbitrary slice lit — the fact
 * sheet's rows and the Body / Scripts tabs ride this so managed facts
 * and live knobs illustrate the same send. `bodyText` swaps the body
 * variant slot the way the dial rows swap the dial leg. A popover
 * carrying it widens to `EXAMPLE_CARD_POPOVER_WIDTH`. */
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
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one settings row. */
export function settingsRowInfo(t: Translate, infoKey: SettingsInfoKey): InfoPopoverContent {
  const kicker = t(GROUP_LABEL_KEY[GROUP_OF[infoKey]]);
  const card = {
    diagram: <SettingsExampleCard lit={new Set([HIGHLIGHT[infoKey]])} dialText={DIAL_VARIANT[infoKey]} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
  };
  if (isDialInfoKey(infoKey)) return { ...dialRowInfo(t, infoKey, kicker), ...card };
  if (isTlsTrustInfoKey(infoKey)) return { ...tlsTrustRowInfo(t, infoKey, kicker), ...card };
  const base = { title: t(TITLE_KEY[infoKey]), kicker, ...card };
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
