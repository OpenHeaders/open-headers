/**
 * Compact topology diagrams for the Backend settings panel — one per
 * scenario. Renders below the picker; shows clients, the back-end
 * container, LAN/WAN reach, TLS/Auth annotations, and the URL pattern
 * for the active mode.
 *
 * Conceptually a "Browser" surface and a "Desktop App" surface render
 * the same workbench UI — so both are drawn as the same macOS-chrome
 * `BrowserWindow`, differentiated by a small `corner` label in the
 * chrome bar. Genuinely different shapes (CLI terminal, daemon rack,
 * cloud-mounted VM) keep their own glyphs.
 *
 * All primitives come from the docs (`BrowserWindow`, `ArrowDefs`,
 * palette tokens) so the visual identity matches the workbench docs.
 * Split by scene:
 *
 *   in-browser.tsx / desktop-app.tsx /
 *   local-self-hosted.tsx / remote-self-hosted.tsx — one scenario each.
 *   device-frames.tsx — desktop / laptop / server hardware containers.
 *   pills.tsx — front-end + back-end pills and the TLS connector.
 */

import type React from 'react';
import type { BackendMode } from '../../schema/backend';
import { DesktopAppDetail } from './desktop-app';
import { InBrowserDetail } from './in-browser';
import { LocalSelfHostedDetail } from './local-self-hosted';
import { RemoteSelfHostedDetail } from './remote-self-hosted';

interface DetailProps {
  mode: BackendMode;
}

export const BackendDetailDiagram: React.FC<DetailProps> = ({ mode }) => {
  switch (mode) {
    case 'in-browser':
      return <InBrowserDetail />;
    case 'desktop-app':
      return <DesktopAppDetail />;
    case 'local-self-hosted':
      return <LocalSelfHostedDetail />;
    case 'remote-self-hosted':
      return <RemoteSelfHostedDetail />;
  }
};
