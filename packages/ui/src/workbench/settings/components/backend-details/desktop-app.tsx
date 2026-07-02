import type React from 'react';
import { ArrowDefs, BrowserWindow, STROKE } from '../../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../../components/docs/diagrams/open-headers/_shared';
import { SurfaceGlyphBody } from '../../../components/docs/shared';
import { DesktopContainer } from './device-frames';
import { BackEndPill, FrontEndPill } from './pills';

export const DesktopAppDetail: React.FC = () => {
  const ID = 'be-desktop-app';
  // The big monitor IS the machine — its screen area holds every
  // process running on it (the browsers + the Open Headers back-end).
  // Layout math:
  //   monitor at (30, 18) → (570, 228), screen inset 10 →
  //   usable screen area (40, 28) → (560, 218).
  return (
    <svg viewBox="0 0 600 350" width="100%" role="img" aria-label="Desktop app back-end">
      <ArrowDefs id={ID} />

      <DesktopContainer x={30} y={18} w={540} h={280} label="Your device">
        {/* Screen content lives inside the inset (y ∈ [28, 188]). The
            monitor's height was tightened so the screen wraps the
            content with even margins — no big empty band at the bottom. */}
        <BrowserWindow x={56} y={56} w={166} h={36} chromeH={18} title="Chrome" corner="Browser" />
        <BrowserWindow x={56} y={102} w={166} h={36} chromeH={18} title="Firefox" corner="Browser" />
        <BrowserWindow x={56} y={148} w={166} h={36} chromeH={18} title="Edge" corner="Browser" />
        <BrowserWindow
          x={56}
          y={196}
          w={166}
          h={48}
          chromeH={14}
          corner="CLI"
          bodyFill="var(--ant-color-text)"
        >
          <text
            x={64}
            y={228}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={13}
            fontWeight={800}
            fill={OH_GREEN}
          >
            $
          </text>
          <rect x={76} y={222} width={6} height={2.5} fill={OH_GREEN} />
        </BrowserWindow>

        {/* Back-end window on the right — same chrome shape as the
            browsers with "Desktop App" corner. Inside: a Front-end pill
            (Workbench + Web App surfaces) stacked above the green
            back-end pill, mirroring the in-browser scenario. */}
        <BrowserWindow x={290} y={50} w={264} h={224} chromeH={20} title="Open Headers" corner="Desktop App">
          <FrontEndPill
            x={302}
            y={84}
            w={240}
            items={[
              {
                label: 'Workbench',
                glyph: <SurfaceGlyphBody surface="workbench" accent="var(--ant-color-primary)" />,
                via: 'desktop · website',
              },
            ]}
            apiClients={['CLI']}
          />
          <BackEndPill x={302} y={196} w={240} engine="Embedded server" where="localhost" />
        </BrowserWindow>

        {/* Connectors from each browser + the CLI right edge to the back-end window. */}
        <line x1={222} y1={74} x2={290} y2={130} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
        <line x1={222} y1={120} x2={290} y2={150} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
        <line x1={222} y1={166} x2={290} y2={170} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
        <line x1={222} y1={220} x2={290} y2={220} stroke={STROKE} strokeWidth={1.4} markerEnd={`url(#${ID})`} />
      </DesktopContainer>

      {/* Footer — descriptive sub-label centered (same pattern as
          the in-browser scenario), with a compact "Localhost" cloud
          + loopback URL parked on the right edge so the middle stays
          devoted to the one-line summary. */}
    </svg>
  );
};
