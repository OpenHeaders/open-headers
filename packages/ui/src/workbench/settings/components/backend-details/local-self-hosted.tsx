import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, BrowserWindow, STROKE } from '../../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../../components/docs/diagrams/open-headers/_shared';
import { SurfaceGlyphBody } from '../../../components/docs/shared';
import { DesktopContainer, LaptopContainer, ServerContainer } from './device-frames';
import { BackEndPill, FrontEndPill } from './pills';

export const LocalSelfHostedDetail: React.FC = () => {
  const t = useT();
  const ID = 'be-local-sh';
  // Layout: two CLIENT device frames stacked on the left (laptop with
  // 2 browsers; desktop with 1 desktop app + 1 browser). The SERVER
  // frame on the right holds the daemon glyph + back-end pill. A LAN
  // cloud sits between, with arrows running client → server.
  //
  // Inner windows render with no title — the chrome bar shows just
  // the traffic-light dots and the corner label ("Browser" /
  // "Desktop App"). The device-container label below tells you whose
  // machine you're looking at.
  // 2×2 layout:
  //   row 1 → Laptop (top-left) · Desktop (top-right)
  //   row 2 → Workstation (bottom-left) · Server (bottom-right)
  // Clients fan into the server through a LAN cloud at the grid's
  // center.
  return (
    <svg
      viewBox="0 0 600 410"
      width="100%"
      role="img"
      aria-label={t('workbench.settings.backendPane.detail.aria.local-self-hosted')}
    >
      <ArrowDefs id={ID} />

      {/* ── Row 1 ─────────────────────────────────────────────── */}

      <LaptopContainer x={20} y={12} w={200} h={108} label={t('workbench.settings.backendDetails.device.laptop')}>
        <BrowserWindow x={30} y={22} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={52} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={82} w={180} h={24} chromeH={11} corner="Desktop App" />
      </LaptopContainer>

      <DesktopContainer x={380} y={12} w={200} h={76} label={t('workbench.settings.backendDetails.device.desktop')}>
        <BrowserWindow x={392} y={24} w={176} h={24} chromeH={12} corner="Desktop App" />
        <BrowserWindow x={392} y={54} w={176} h={24} chromeH={12} corner="Browser" />
      </DesktopContainer>

      {/* ── Row 2 ─────────────────────────────────────────────── */}

      <DesktopContainer x={20} y={172} w={200} h={72} label={t('workbench.settings.backendDetails.device.workstation')}>
        {/* Same chrome shape as the laptop's browser rows — traffic
            lights on the left, italic "CLI" corner on the right — but
            the body is filled black with a green `$ _` prompt so the
            window reads as a terminal at a glance. Sized to fill the
            workstation's inset like the laptop's stacked browsers. */}
        <BrowserWindow
          x={30}
          y={184}
          w={180}
          h={48}
          chromeH={14}
          corner="CLI"
          bodyFill="var(--ant-color-text)"
        >
          <text
            x={38}
            y={216}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={13}
            fontWeight={800}
            fill={OH_GREEN}
          >
            $
          </text>
          <rect x={50} y={210} width={6} height={2.5} fill={OH_GREEN} />
        </BrowserWindow>
      </DesktopContainer>

      <ServerContainer x={320} y={148} w={260} h={234} label={t('workbench.settings.backendDetails.device.localServer')}>
        <FrontEndPill
          x={332}
          y={178}
          w={236}
          items={[
            {
              label: 'Workbench',
              glyph: <SurfaceGlyphBody surface="workbench" accent="var(--ant-color-primary)" />,
              via: 'website',
            },
          ]}
          apiClients={['CLI']}
          surfacesOptional
        />
        <BackEndPill x={332} y={290} w={236} engine="Local server" where="Localhost/LAN" />
      </ServerContainer>

      {/* Connectors — clean geometry, no overlap with container labels:
            • Laptop bottom-right → server top-left  (diagonal across)
            • Desktop bottom-LEFT → server top  (offset from x=480 to
              x=420 so the vertical line doesn't cross the centered
              "Desktop" label that sits below the desktop container)
            • Workstation right → server left  (near-horizontal) */}
      <line x1={220} y1={94} x2={320} y2={200} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
      <line x1={420} y1={88} x2={420} y2={148} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
      <line x1={220} y1={208} x2={320} y2={230} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />

    </svg>
  );
};
