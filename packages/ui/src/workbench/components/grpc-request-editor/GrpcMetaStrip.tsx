/**
 * GrpcMetaStrip — the glanceable `status · time` line in the gRPC
 * result pane's tab bar, the HTTP ResponseMetaStrip's sibling: the
 * status pill carries a hover popover explaining the code's canonical
 * meaning, facts separate with the shared MetaDot, and the stream
 * phases ride as badges (STREAMING while live, Stopped after a
 * cancel). The panes append their own ⋯ actions menu after it.
 */

import { GRPC_STATUS_NAMES, grpcStatusLabel } from '@openheaders/core/proto';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { MetaDot } from '../request-editor/response/ResponseMetaStrip';

const { Text } = Typography;

/** Canonical description key per protocol status name — a literal map
 *  so the catalog keys stay statically checked (no dynamic key
 *  composition). */
const STATUS_DESC_KEYS: Readonly<Record<string, MessageKey>> = {
  OK: 'workbench.editors.grpc.status.desc.OK',
  CANCELLED: 'workbench.editors.grpc.status.desc.CANCELLED',
  UNKNOWN: 'workbench.editors.grpc.status.desc.UNKNOWN',
  INVALID_ARGUMENT: 'workbench.editors.grpc.status.desc.INVALID_ARGUMENT',
  DEADLINE_EXCEEDED: 'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED',
  NOT_FOUND: 'workbench.editors.grpc.status.desc.NOT_FOUND',
  ALREADY_EXISTS: 'workbench.editors.grpc.status.desc.ALREADY_EXISTS',
  PERMISSION_DENIED: 'workbench.editors.grpc.status.desc.PERMISSION_DENIED',
  RESOURCE_EXHAUSTED: 'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED',
  FAILED_PRECONDITION: 'workbench.editors.grpc.status.desc.FAILED_PRECONDITION',
  ABORTED: 'workbench.editors.grpc.status.desc.ABORTED',
  OUT_OF_RANGE: 'workbench.editors.grpc.status.desc.OUT_OF_RANGE',
  UNIMPLEMENTED: 'workbench.editors.grpc.status.desc.UNIMPLEMENTED',
  INTERNAL: 'workbench.editors.grpc.status.desc.INTERNAL',
  UNAVAILABLE: 'workbench.editors.grpc.status.desc.UNAVAILABLE',
  DATA_LOSS: 'workbench.editors.grpc.status.desc.DATA_LOSS',
  UNAUTHENTICATED: 'workbench.editors.grpc.status.desc.UNAUTHENTICATED',
};

/** Popover content for one status pill; unknown codes get the honest
 *  fallback. */
export function grpcStatusInfoContent(t: Translate, status: number): InfoPopoverContent {
  const name = GRPC_STATUS_NAMES[status];
  const descKey = name === undefined ? undefined : STATUS_DESC_KEYS[name];
  return {
    title: grpcStatusLabel(status),
    kicker: t('workbench.editors.grpc.status.kicker'),
    summary: descKey === undefined ? t('workbench.editors.grpc.status.desc.unknownCode') : t(descKey),
  };
}

const GrpcMetaStrip: React.FC<{
  /** Wire status; null when the reply carried none. */
  status: number | null;
  durationMs: number;
  /** Cancelled mid-stream — the Stopped badge. */
  stopped?: boolean;
}> = ({ status, durationMs, stopped }) => {
  const { token } = theme.useToken();
  const t = useT();
  // A caller-stopped call whose reply carried no status reads as
  // 1 CANCELLED — the gRPC client-runtime semantic for a local cancel
  // (display-side only; the capture keeps its honest null).
  const displayStatus = status ?? (stopped === true ? 1 : null);
  const statusColor = displayStatus === 0 ? token.colorSuccess : token.colorError;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      {displayStatus === null ? (
        <Tag color="default" style={{ marginInlineEnd: 0 }} data-testid="grpc-status-tag">
          {t('workbench.editors.grpc.response.noStatus')}
        </Tag>
      ) : (
        <InfoPopover content={grpcStatusInfoContent(t, displayStatus)} trigger="hover">
          <Tag
            color="default"
            style={{ color: statusColor, borderColor: statusColor, marginInlineEnd: 0, cursor: 'help' }}
            data-testid="grpc-status-tag"
          >
            {grpcStatusLabel(displayStatus)}
          </Tag>
        </InfoPopover>
      )}
      {stopped === true && (
        <InfoPopover
          content={{
            title: t('workbench.editors.grpc.stream.stoppedBadge'),
            kicker: t('workbench.editors.request.response.meta.kicker'),
            summary: t('workbench.editors.request.response.meta.streamedPartialSummary'),
          }}
          trigger="hover"
        >
          <Tag color="default" style={{ marginInlineEnd: 0, cursor: 'help' }} data-testid="grpc-stopped-tag">
            {t('workbench.editors.grpc.stream.stoppedBadge')}
          </Tag>
        </InfoPopover>
      )}
      <MetaDot />
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        {t('workbench.editors.grpc.response.duration', { ms: durationMs })}
      </Text>
    </span>
  );
};

export default GrpcMetaStrip;
