import type React from 'react';
import { BrowserWindow } from '../../../components/docs/diagrams/_shared';
import { SURFACE_LABELS, SurfaceGlyphBody } from '../../../components/docs/shared';
import { DesktopContainer } from './device-frames';
import { BackEndPill, FrontEndPill } from './pills';

export const InBrowserDetail: React.FC = () => (
  <svg viewBox="0 0 600 350" width="100%" role="img" aria-label="In-browser back-end">
    <DesktopContainer x={30} y={18} w={540} h={280} label="Your device">
      <BrowserWindow x={56} y={42} w={488} h={240} chromeH={20} title="Open Headers — Chrome / Edge / Firefox" corner="Browser">
        <FrontEndPill
          x={70}
          y={82}
          w={460}
          items={(['popup', 'workbench', 'devtools', 'side-panel'] as const).map((s) => ({
            label: SURFACE_LABELS[s],
            glyph: <SurfaceGlyphBody surface={s} accent="var(--ant-color-primary)" />,
          }))}
        />
        <BackEndPill x={70} y={196} w={460} engine="Embedded browser service worker" where="no wire" />
      </BrowserWindow>
    </DesktopContainer>
  </svg>
);
