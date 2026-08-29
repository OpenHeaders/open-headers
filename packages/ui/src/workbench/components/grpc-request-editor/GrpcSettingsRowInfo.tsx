/**
 * `(i)` info-popover content for the gRPC editor's Settings-tab knobs
 * and group headers — kicker (the group), title (the row's own
 * label), and the knob's copy as the summary; the TLS & trust rows
 * read the shared block's copy. No example card: the
 * protocol's channel card is its own surface when it lands, never a
 * leg on the MQTT session card.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { GRPC_GROUP_LABEL_KEY, type GrpcSettingsGroupKey } from './settings-groups';

export type GrpcInfoKey = 'unixSocket' | 'timeout' | 'responseSizeLimit' | 'sendInvalidMessage';

const TITLE_KEY: Record<GrpcInfoKey, MessageKey> = {
  unixSocket: 'workbench.editors.grpc.settings.unixSocketLabel',
  timeout: 'workbench.editors.grpc.settings.timeoutLabel',
  responseSizeLimit: 'workbench.editors.request.settings.responseSizeLimit',
  sendInvalidMessage: 'workbench.editors.grpc.settings.sendInvalidMessageLabel',
};

const SUMMARY_KEY: Record<GrpcInfoKey, MessageKey> = {
  unixSocket: 'workbench.editors.grpc.settings.unixSocketHelp',
  timeout: 'workbench.editors.grpc.settings.timeoutHelp',
  responseSizeLimit: 'workbench.editors.request.settings.responseSizeLimitInfo',
  sendInvalidMessage: 'workbench.editors.grpc.settings.sendInvalidMessageHelp',
};

const KICKER_GROUP: Record<GrpcInfoKey, GrpcSettingsGroupKey> = {
  unixSocket: 'connection',
  timeout: 'connection',
  responseSizeLimit: 'connection',
  sendInvalidMessage: 'messages',
};

const GROUP_SUMMARY_KEY: Record<GrpcSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.grpc.settings.groupInfo.connection',
  tls: 'workbench.editors.grpc.settings.groupInfo.tls',
  messages: 'workbench.editors.grpc.settings.groupInfo.messages',
};

/** Popover content for a Settings-tab group header. */
export function grpcSettingsGroupInfo(t: Translate, group: GrpcSettingsGroupKey): InfoPopoverContent {
  return {
    title: t(GRPC_GROUP_LABEL_KEY[group]),
    kicker: t('workbench.editors.grpc.tab.settings'),
    summary: t(GROUP_SUMMARY_KEY[group]),
  };
}

/** Popover content for one gRPC knob. */
export function grpcSettingsRowInfo(t: Translate, infoKey: GrpcInfoKey): InfoPopoverContent {
  return {
    title: t(TITLE_KEY[infoKey]),
    kicker: t(GRPC_GROUP_LABEL_KEY[KICKER_GROUP[infoKey]]),
    summary: t(SUMMARY_KEY[infoKey]),
  };
}
