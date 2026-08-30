/**
 * GrpcMetaStrip — the glanceable status pill in the gRPC result
 * pane's tab bar, the HTTP ResponseMetaStrip's sibling: the pill
 * carries a hover popover explaining the code's canonical meaning; a
 * cancel reads as 1 CANCELLED. The panes append their own ⋯ actions
 * menu after it.
 */

import { GRPC_STATUS_NAMES, grpcStatusLabel } from '@openheaders/core/proto';
import type { ExecutedAuthAttribution, ExecutedProxyRoute } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag, theme } from 'antd';
import type React from 'react';
import AuthAttributionTag, { authAttributionHasBadge } from '../request-editor/response/AuthAttributionTag';
import ProxyRouteTag, { proxyRouteHasBadge } from '../request-editor/response/ProxyRouteTag';

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
  /** Cancelled mid-stream — reads as 1 CANCELLED when the reply carried no status. */
  stopped?: boolean;
  /** The classified LOCAL failure — the call never produced a response
   *  head. With `localStatus` the pill reads the canonical code the
   *  client runtime assigned (e.g. 14 UNAVAILABLE, the status popover
   *  explaining it); without one it reads the error-tinted "Call
   *  failed" pill with the classified message on hover. The capture's
   *  wire status stays its honest null either way. */
  error?: string;
  /** The failure's client-runtime canonical status (see
   *  `ExecutedGrpcSnapshot.localStatus`); rides only beside `error`. */
  localStatus?: number;
  /** The connection died AFTER the head (see
   *  `ExecutedGrpcSnapshot.connectionError`) — the reply carried no
   *  status, so the pill reads the error-tinted "Connection lost" with
   *  the reason on hover; the capture's null status stays honest. */
  connectionError?: string;
  /** The capture's proxy-routing wire truth — the shared attribution
   *  tag when a plane proxied (or stood down for) the dial. Examples
   *  strip it with the other volatile internals, so they omit it. */
  proxyRoute?: ExecutedProxyRoute;
  /** The auth the call actually carried (see `ExecutedGrpcSnapshot.auth`)
   *  — the shared attribution tag; examples omit it like the route. */
  auth?: ExecutedAuthAttribution;
}> = ({ status, stopped, error, localStatus, connectionError, proxyRoute, auth }) => {
  const { token } = theme.useToken();
  const t = useT();
  // A caller-stopped call whose reply carried no status reads as
  // 1 CANCELLED, and a local failure reads its canonical code — the
  // gRPC client-runtime semantics (display-side only; the capture
  // keeps its honest null).
  const displayStatus = status ?? localStatus ?? (stopped === true ? 1 : null);
  const statusColor = displayStatus === 0 ? token.colorSuccess : token.colorError;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      {error !== undefined && displayStatus === null ? (
        <InfoPopover
          content={{ title: t('workbench.editors.grpc.response.error.title'), summary: error }}
          trigger="hover"
        >
          <Tag color="error" style={{ marginInlineEnd: 0, cursor: 'help' }} data-testid="grpc-call-failed-tag">
            {t('workbench.editors.grpc.response.error.title')}
          </Tag>
        </InfoPopover>
      ) : connectionError !== undefined && displayStatus === null ? (
        <InfoPopover
          content={{ title: t('workbench.editors.grpc.response.connectionLost'), summary: connectionError }}
          trigger="hover"
        >
          <Tag color="error" style={{ marginInlineEnd: 0, cursor: 'help' }} data-testid="grpc-connection-lost-tag">
            {t('workbench.editors.grpc.response.connectionLost')}
          </Tag>
        </InfoPopover>
      ) : displayStatus === null ? (
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
      {proxyRouteHasBadge(proxyRoute) && <ProxyRouteTag route={proxyRoute} />}
      {authAttributionHasBadge(auth) && <AuthAttributionTag auth={auth} />}
    </span>
  );
};

export default GrpcMetaStrip;
