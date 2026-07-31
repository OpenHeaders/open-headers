/**
 * ProxyRouteTag — the meta-strip attribution tag for a run whose proxy
 * routing was decided by a plane, rendered from the record's
 * `proxyRoute` wire truth (never a live settings read): "Proxied" when
 * the run actually tunneled through a proxy, "Proxy bypassed" when an
 * inherited environment proxy stood down for an explicit ask and the
 * run proceeded direct. A route that decided plain direct (a NO_PROXY
 * match, an explicit direct opt-out) renders nothing — quiet direct is
 * the baseline, not a badge. Shared by the HTTP ResponseMetaStrip and
 * the WS/gRPC session strips; their records carry the same shape.
 */

import type { ExecutedProxyRoute } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag, theme } from 'antd';
import type React from 'react';

function sourceLabel(route: ExecutedProxyRoute, t: Translate): string {
  if (route.plane === 'request') return t('workbench.editors.request.response.meta.proxySourceRequest');
  switch (route.source) {
    case 'env':
      return t('workbench.editors.request.response.meta.proxySourceEnv');
    case 'system':
      return t('workbench.editors.request.response.meta.proxySourceSystem');
    case 'manual':
      return t('workbench.editors.request.response.meta.proxySourceManual');
    case 'pac':
      return t('workbench.editors.request.response.meta.proxySourcePac');
    default:
      return t('workbench.editors.request.response.meta.proxySourceEnvironment');
  }
}

function standDownSummary(reason: NonNullable<ExecutedProxyRoute['standDownReason']>, t: Translate): string {
  switch (reason) {
    case 'unix-socket':
      return t('workbench.editors.request.response.meta.proxyStandDownUnixSocket');
    case 'resolve-to-address':
      return t('workbench.editors.request.response.meta.proxyStandDownResolveToAddress');
    case 'http-version-3':
      return t('workbench.editors.request.response.meta.proxyStandDownHttpVersion3');
    default: {
      const _exhaustive: never = reason;
      void _exhaustive;
      return '';
    }
  }
}

function ProxyRouteFacts({ route }: { route: ExecutedProxyRoute }) {
  const { token } = theme.useToken();
  const t = useT();
  const rows: Array<{ label: string; value: string }> = [
    ...(route.proxyUrl !== undefined
      ? [{ label: t('workbench.editors.request.response.meta.proxyRowUrl'), value: route.proxyUrl }]
      : []),
    { label: t('workbench.editors.request.response.meta.proxyRowSource'), value: sourceLabel(route, t) },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, maxWidth: 380 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12 }}>
          <span style={{ width: 110, flexShrink: 0, color: token.colorTextSecondary }}>{row.label}</span>
          <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function proxiedContent(route: ExecutedProxyRoute, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.proxyTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary:
      route.plane === 'request'
        ? t('workbench.editors.request.response.meta.proxySummaryRequest')
        : t('workbench.editors.request.response.meta.proxySummaryEnvironment'),
    description: <ProxyRouteFacts route={route} />,
  };
}

function standDownContent(
  reason: NonNullable<ExecutedProxyRoute['standDownReason']>,
  t: Translate,
): InfoPopoverContent {
  return {
    title: t('workbench.editors.request.response.meta.proxyStandDownTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: standDownSummary(reason, t),
  };
}

/** Whether the route earns a badge — a tunnel or a stand-down; a plain
 *  direct decision stays quiet. The strips gate their separator dot on
 *  this so the tag never leaves an orphaned dot behind. */
export function proxyRouteHasBadge(route: ExecutedProxyRoute | undefined): route is ExecutedProxyRoute {
  return route !== undefined && (route.proxyUrl !== undefined || route.standDownReason !== undefined);
}

/** Renders nothing for a plain direct decision; otherwise the neutral
 *  attribution tag with its hover popover. */
const ProxyRouteTag: React.FC<{ route: ExecutedProxyRoute | undefined }> = ({ route }) => {
  const t = useT();
  if (route === undefined) return null;
  if (route.standDownReason !== undefined) {
    return (
      <InfoPopover content={standDownContent(route.standDownReason, t)} trigger="hover">
        <Tag color="default" data-testid="oh-response-proxy-route" style={{ marginInlineEnd: 0, cursor: 'help' }}>
          {t('workbench.editors.request.response.meta.proxyStandDownTag')}
        </Tag>
      </InfoPopover>
    );
  }
  if (route.proxyUrl === undefined) return null;
  return (
    <InfoPopover content={proxiedContent(route, t)} trigger="hover">
      <Tag color="default" data-testid="oh-response-proxy-route" style={{ marginInlineEnd: 0, cursor: 'help' }}>
        {t('workbench.editors.request.response.meta.proxyTag')}
      </Tag>
    </InfoPopover>
  );
};

export default ProxyRouteTag;
