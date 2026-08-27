/**
 * Topical group vocabulary of the gRPC Settings tab — shared by the
 * live knob sections and each row's info-popover kicker, so both read
 * in the same order with the same labels. The Messages group carries
 * the app-wide invalid-message posture, not a per-request field.
 */

import type { MessageKey } from '@openheaders/i18n';

export type GrpcSettingsGroupKey = 'connection' | 'tls' | 'messages';

export const GRPC_GROUP_ORDER: GrpcSettingsGroupKey[] = ['connection', 'tls', 'messages'];

export const GRPC_GROUP_LABEL_KEY: Record<GrpcSettingsGroupKey, MessageKey> = {
  connection: 'workbench.editors.grpc.settings.group.connection',
  tls: 'workbench.editors.grpc.settings.group.tls',
  messages: 'workbench.editors.grpc.settings.group.messages',
};
