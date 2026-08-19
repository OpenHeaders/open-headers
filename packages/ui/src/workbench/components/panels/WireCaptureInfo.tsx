/**
 * `(i)` info-popover content for the wire capture control's two
 * load-bearing settings — Decrypt scope and Route browsers. Same
 * pattern as the network table's `NetworkColumnInfo`: every popover
 * leads with a compact colored example card (the `dt-col-eg` classes
 * the column popovers share) so the control's effect is shown on a
 * concrete host before it is described.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

/** The one example scope both cards illustrate. */
const EX = {
  scoped: 'api.openheaders.com',
  wildcard: '*.dev.openheaders.com',
  scopedUrl: 'https://api.openheaders.com/v1/users',
  otherUrl: 'https://cdn.example.com/app.js',
} as const;

function ScopeExampleCard() {
  const t = useT();
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{t('workbench.proxyCapture.scopeInfo.exampleCaption')}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line dt-col-eg-meta">
          <span className="dt-col-eg-tok dt-col-eg-hl">{EX.scoped}</span>
          {' · '}
          <span className="dt-col-eg-tok dt-col-eg-hl">{EX.wildcard}</span>
        </div>
        <div className="dt-col-eg-line dt-col-eg-url">
          <span className="dt-col-eg-tok">{EX.scopedUrl}</span>
          <span className="dt-col-eg-sep"> → </span>
          <span className="dt-col-eg-tok dt-col-eg-hl">{t('workbench.proxyCapture.scopeInfo.exampleDecrypted')}</span>
        </div>
        <div className="dt-col-eg-line dt-col-eg-url">
          <span className="dt-col-eg-tok">{EX.otherUrl}</span>
          <span className="dt-col-eg-sep"> → </span>
          <span className="dt-col-eg-sep">{t('workbench.proxyCapture.scopeInfo.exampleOpaque')}</span>
        </div>
      </div>
    </div>
  );
}

function RoutingExampleCard({ port }: { port: number | null }) {
  const t = useT();
  const proxyLeg = `PROXY 127.0.0.1:${port ?? '…'}; DIRECT`;
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{t('workbench.proxyCapture.routingInfo.exampleCaption')}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line dt-col-eg-url">
          <span className="dt-col-eg-tok dt-col-eg-hl">{EX.scoped}</span>
          <span className="dt-col-eg-sep"> → </span>
          <span className="dt-col-eg-tok dt-col-eg-hl">{proxyLeg}</span>
        </div>
        <div className="dt-col-eg-line dt-col-eg-url">
          <span className="dt-col-eg-tok">{EX.otherUrl}</span>
          <span className="dt-col-eg-sep"> → </span>
          <span className="dt-col-eg-sep">DIRECT</span>
        </div>
      </div>
    </div>
  );
}

function scopeInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.proxyCapture.scope'),
    kicker: t('workbench.trafficMonitor.systemProxy'),
    diagram: <ScopeExampleCard />,
    summary: t('workbench.proxyCapture.scopeInfo.summary'),
    description: t('workbench.proxyCapture.scopeInfo.description'),
    sections: [
      {
        heading: t('workbench.proxyCapture.scopeInfo.patternsHeading'),
        items: [
          { label: 'example.com', desc: t('workbench.proxyCapture.scopeInfo.exactDesc') },
          { label: '*.example.com', desc: t('workbench.proxyCapture.scopeInfo.wildcardDesc') },
          { label: '192.168.1.10', desc: t('workbench.proxyCapture.scopeInfo.ipDesc') },
        ],
      },
    ],
  };
}

function routingInfo(t: Translate, port: number | null): InfoPopoverContent {
  return {
    title: t('workbench.proxyCapture.routing'),
    kicker: t('workbench.trafficMonitor.systemProxy'),
    diagram: <RoutingExampleCard port={port} />,
    summary: t('workbench.proxyCapture.routingInfo.summary'),
    description: t('workbench.proxyCapture.routingInfo.description'),
    sections: [
      {
        heading: t('workbench.proxyCapture.routingInfo.behaviorHeading'),
        items: [
          { label: 'PAC / onRequest', desc: t('workbench.proxyCapture.routingInfo.appliedDesc') },
          { label: 'DIRECT', desc: t('workbench.proxyCapture.routingInfo.failoverDesc') },
          { label: 'h3 → h2', desc: t('workbench.proxyCapture.routingInfo.h3Desc') },
        ],
      },
    ],
  };
}

export function ScopeInfoTrigger() {
  const t = useT();
  return <InfoTrigger content={scopeInfo(t)} />;
}

export function RoutingInfoTrigger({ port }: { port: number | null }) {
  const t = useT();
  return <InfoTrigger content={routingInfo(t, port)} />;
}
