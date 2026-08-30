/**
 * `(i)` info-popover content for the gRPC editor's Settings-tab knobs
 * and group headers — the request Settings tab's `SettingsRowInfo`
 * idiom brought to the call: kicker (the group), title (the row's own
 * label), the shared example card with the popover's slice lit, then
 * the knob's copy.
 *
 * Every popover leads with the SAME canonical example call — one
 * server-streaming RPC on one channel — and lights its own token, so
 * reading across the rows builds one coherent picture of a single
 * call seen knob by knob; the group headers light their whole
 * sub-slice, partitioning the card the rows itemize, and the
 * runtime-managed sheet's facts (HTTP/2, no compression, one
 * connection per call) light theirs. The dial leg is the card's one
 * variant slot (the shared `DIAL_LEG_TEXT` vocabulary).
 *
 * The rows of the shared blocks (dial, TLS & trust) compose the
 * blocks' own copy — summary, description, glossary — under this
 * editor's card. Card tokens ride raw (wire vocabulary — the
 * column-card precedent); only the caption is localized.
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
import { GRPC_GROUP_LABEL_KEY, type GrpcSettingsGroupKey } from './settings-groups';

/** The editor's own knobs. */
type GrpcOwnInfoKey =
  | 'authority'
  | 'unixSocket'
  | 'timeout'
  | 'responseSizeLimit'
  | 'keepaliveInterval'
  | 'keepaliveTimeout'
  | 'sendInvalidMessage';

/** One key per knob that opens a popover with the card. */
export type GrpcInfoKey = GrpcOwnInfoKey | DialInfoKey | TlsTrustInfoKey;

/** The single call every popover illustrates. Holding one example
 * fixed across all popovers lets the user map each knob onto the same
 * concrete call. */
const EX = {
  target: 'api.openheaders.com:443',
  method: 'books.v1.Library/WatchBooks',
  kind: 'server stream',
  dial: 'direct',
  authority: ':authority api.openheaders.com',
  deadline: 'deadline 30 s',
  cap: 'reply ≤ 2 MB',
  ping: 'ping every 30 s',
  pingWait: 'pong ≤ 20 s',
  tlsWindow: 'TLS 1.2–1.3',
  verify: 'verify ✓',
  suite: 'TLS_AES_128_GCM_SHA256',
  cert: 'cert: acme-mtls',
  sni: 'sni: api.openheaders.com',
  h2: 'h2',
  compression: 'compression: none',
  reuse: '1 connection per call',
  invalid: 'invalid message: rejected',
} as const;

type TokenId = keyof typeof EX;

/** Tokens of the shared example — for the runtime-managed sheet's
 * rows, which map onto slices of the same call. */
export type GrpcExampleToken = TokenId;

/** Which token of the example each row lights. The TLS window is one
 * token — min and max both light it. */
const HIGHLIGHT: Record<GrpcInfoKey, TokenId> = {
  resolveToAddress: 'dial',
  proxy: 'dial',
  proxyUrl: 'dial',
  proxyCredentials: 'dial',
  unixSocket: 'dial',
  authority: 'authority',
  timeout: 'deadline',
  responseSizeLimit: 'cap',
  keepaliveInterval: 'ping',
  keepaliveTimeout: 'pingWait',
  sendInvalidMessage: 'invalid',
  sslVerification: 'verify',
  clientCertificate: 'cert',
  tlsMin: 'tlsWindow',
  tlsMax: 'tlsWindow',
  tlsCipherSuites: 'suite',
  sni: 'sni',
};

/** Rows that swap the dial slot to their own leg. */
const DIAL_VARIANT: Partial<Record<GrpcInfoKey, string>> = DIAL_LEG_TEXT;

/** Each group's sub-slice of the example — the union of its rows'
 * tokens, so the group popovers partition the card between them. */
const GROUP_TOKENS: Record<GrpcSettingsGroupKey, readonly TokenId[]> = {
  connection: ['dial', 'authority', 'deadline', 'cap', 'ping', 'pingWait'],
  tls: ['tlsWindow', 'verify', 'suite', 'cert', 'sni'],
  messages: ['invalid'],
};

function GrpcExampleCard({ lit, dialText }: { lit: ReadonlySet<TokenId>; dialText?: string }) {
  const t = useT();
  const tok = (id: TokenId, text: string = EX[id]) => ({ id, text });
  const lines: ExampleCardLine<TokenId>[] = [
    { opener: 'CALL', tokens: [tok('target'), tok('method'), tok('kind')] },
    {
      tokens: [tok('dial', dialText), tok('authority'), tok('deadline'), tok('cap'), tok('ping'), tok('pingWait')],
    },
    { tokens: [tok('tlsWindow'), tok('verify'), tok('suite'), tok('cert'), tok('sni')] },
    { tokens: [tok('h2'), tok('compression'), tok('reuse'), tok('invalid')] },
  ];
  return <ExampleCard caption={t('workbench.editors.grpc.settings.exampleCaption')} lines={lines} lit={lit} />;
}

/** The shared example card with an arbitrary slice lit — the
 * runtime-managed sheet's rows ride this so managed facts and live
 * knobs illustrate the same call. */
export function grpcExampleCard(lit: readonly GrpcExampleToken[]): React.ReactElement {
  return <GrpcExampleCard lit={new Set(lit)} />;
}

const TITLE_KEY: Record<GrpcOwnInfoKey, MessageKey> = {
  authority: 'workbench.editors.grpc.settings.authorityLabel',
  unixSocket: 'workbench.editors.grpc.settings.unixSocketLabel',
  timeout: 'workbench.editors.grpc.settings.timeoutLabel',
  responseSizeLimit: 'workbench.editors.request.settings.responseSizeLimit',
  keepaliveInterval: 'workbench.editors.grpc.settings.keepaliveIntervalLabel',
  keepaliveTimeout: 'workbench.editors.grpc.settings.keepaliveTimeoutLabel',
  sendInvalidMessage: 'workbench.editors.grpc.settings.sendInvalidMessageLabel',
};

const SUMMARY_KEY: Record<GrpcOwnInfoKey, MessageKey> = {
  authority: 'workbench.editors.grpc.settings.authorityHelp',
  unixSocket: 'workbench.editors.grpc.settings.unixSocketHelp',
  timeout: 'workbench.editors.grpc.settings.timeoutHelp',
  responseSizeLimit: 'workbench.editors.request.settings.responseSizeLimitInfo',
  keepaliveInterval: 'workbench.editors.grpc.settings.keepaliveIntervalHelp',
  keepaliveTimeout: 'workbench.editors.grpc.settings.keepaliveTimeoutHelp',
  sendInvalidMessage: 'workbench.editors.grpc.settings.sendInvalidMessageHelp',
};

const GROUP_OF: Record<GrpcInfoKey, GrpcSettingsGroupKey> = {
  resolveToAddress: 'connection',
  proxy: 'connection',
  proxyUrl: 'connection',
  proxyCredentials: 'connection',
  authority: 'connection',
  unixSocket: 'connection',
  timeout: 'connection',
  responseSizeLimit: 'connection',
  keepaliveInterval: 'connection',
  keepaliveTimeout: 'connection',
  sslVerification: 'tls',
  clientCertificate: 'tls',
  tlsMin: 'tls',
  tlsMax: 'tls',
  tlsCipherSuites: 'tls',
  sni: 'tls',
  sendInvalidMessage: 'messages',
};

const GROUP_SUMMARY_KEY: Record<GrpcSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.grpc.settings.groupInfo.connection',
  tls: 'workbench.editors.grpc.settings.groupInfo.tls',
  messages: 'workbench.editors.grpc.settings.groupInfo.messages',
};

/** Popover content for a Settings-tab group header: the group's whole
 * sub-slice of the shared example lit at once. */
export function grpcSettingsGroupInfo(t: Translate, group: GrpcSettingsGroupKey): InfoPopoverContent {
  return {
    title: t(GRPC_GROUP_LABEL_KEY[group]),
    kicker: t('workbench.editors.grpc.tab.settings'),
    diagram: <GrpcExampleCard lit={new Set(GROUP_TOKENS[group])} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one gRPC knob. */
export function grpcSettingsRowInfo(t: Translate, infoKey: GrpcInfoKey): InfoPopoverContent {
  const kicker = t(GRPC_GROUP_LABEL_KEY[GROUP_OF[infoKey]]);
  const card = {
    diagram: <GrpcExampleCard lit={new Set([HIGHLIGHT[infoKey]])} dialText={DIAL_VARIANT[infoKey]} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
  };
  if (isDialInfoKey(infoKey)) return { ...dialRowInfo(t, infoKey, kicker), ...card };
  if (isTlsTrustInfoKey(infoKey)) return { ...tlsTrustRowInfo(t, infoKey, kicker), ...card };
  return { title: t(TITLE_KEY[infoKey]), kicker, summary: t(SUMMARY_KEY[infoKey]), ...card };
}
