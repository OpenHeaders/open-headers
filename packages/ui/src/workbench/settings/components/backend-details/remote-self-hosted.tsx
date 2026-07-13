import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, BrowserWindow } from '../../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../../components/docs/diagrams/open-headers/_shared';
import { SurfaceGlyphBody } from '../../../components/docs/shared';
import { DesktopContainer, LaptopContainer, ServerContainer } from './device-frames';
import { BackEndPill, ConnectorTls, FrontEndPill } from './pills';

export const RemoteSelfHostedDetail: React.FC = () => {
  const t = useT();
  const ID = 'be-remote-sh';
  // Same 2×2 device-container layout as Local/LAN — same client
  // shapes (laptop, desktop, workstation) on the left and top-right,
  // with the back-end frame at bottom-right. The two scenarios differ
  // only in: WAN cloud between rows, TLS-padlock connectors instead
  // of plain lines, `wss://` URL, and the back-end is a VM "on the
  // internet" instead of a daemon "on your LAN".
  return (
    <svg
      viewBox="0 0 600 410"
      width="100%"
      role="img"
      aria-label={t('workbench.settings.backendPane.detail.aria.remote-self-hosted')}
    >
      <ArrowDefs id={ID} />

      {/* ── Row 1 ─────────────────────────────────────────────── */}

      <LaptopContainer x={20} y={12} w={200} h={108} label="Laptop">
        <BrowserWindow x={30} y={22} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={52} w={180} h={24} chromeH={11} corner="Browser" />
        <BrowserWindow x={30} y={82} w={180} h={24} chromeH={11} corner="Desktop App" />
      </LaptopContainer>

      <DesktopContainer x={380} y={12} w={200} h={76} label="Desktop">
        <BrowserWindow x={392} y={24} w={176} h={24} chromeH={12} corner="Desktop App" />
        <BrowserWindow x={392} y={54} w={176} h={24} chromeH={12} corner="Browser" />
      </DesktopContainer>

      {/* ── Row 2 ─────────────────────────────────────────────── */}

      <DesktopContainer x={20} y={148} w={200} h={72} label="Workstation">
        <BrowserWindow
          x={30}
          y={160}
          w={180}
          h={48}
          chromeH={14}
          corner="CLI"
          bodyFill="var(--ant-color-text)"
        >
          <text
            x={38}
            y={192}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={13}
            fontWeight={800}
            fill={OH_GREEN}
          >
            $
          </text>
          <rect x={50} y={186} width={6} height={2.5} fill={OH_GREEN} />
        </BrowserWindow>
      </DesktopContainer>

      {/* CI/CD container — automated client driven by a workflow YAML
          (GitHub Actions, GitLab CI, Jenkins, etc.). Visual parallel to
          the CLI terminal above: same dark body, but the content is a
          mocked workflow file (green keys, dim values) instead of a
          shell prompt. The CLI window is for interactive sessions; this
          one is for unattended pipeline runs. Both hit the back-end. */}
      <DesktopContainer x={20} y={232} w={200} h={72} label="CI/CD">
        <BrowserWindow
          x={30}
          y={244}
          w={180}
          h={48}
          chromeH={14}
          corner="Workflow"
          bodyFill="var(--ant-color-text)"
        >
          {(() => {
            const lines: { key: string; value: string }[] = [
              { key: 'name:', value: 'deploy latest' },
              { key: 'on:', value: 'push @ main' },
              { key: 'run:', value: 'oh apply --env dev' },
            ];
            const startY = 268;
            return lines.map((ln, i) => (
              <g key={ln.key}>
                <text
                  x={38}
                  y={startY + i * 9}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize={7.5}
                  fontWeight={700}
                  fill={OH_GREEN}
                >
                  {ln.key}
                </text>
                {ln.value && (
                  <text
                    x={72}
                    y={startY + i * 9}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontSize={7.5}
                    fill="rgba(255, 255, 255, 0.7)"
                  >
                    {ln.value}
                  </text>
                )}
              </g>
            ));
          })()}
        </BrowserWindow>
      </DesktopContainer>

      <ServerContainer x={320} y={148} w={260} h={234} label="Remote server">
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
          apiClients={['CLI', 'CI/CD']}
          surfacesOptional
        />
        <BackEndPill x={332} y={290} w={236} engine="Remote server" where="Internet/WAN" />
      </ServerContainer>

      {/* TLS connectors — all client → VM links cross the public
            internet, so each gets a padlock annotation:
            • Laptop bottom-right → VM top-left  (diagonal across)
            • Desktop bottom-LEFT → VM top  (offset from x=480 to
              x=420 so the vertical line doesn't cross the centered
              "Desktop" label below the desktop container)
            • Workstation right → VM left  (near-horizontal) */}
      <ConnectorTls id={ID} x1={220} y1={94} x2={320} y2={200} />
      <ConnectorTls id={ID} x1={420} y1={88} x2={420} y2={148} />
      <ConnectorTls id={ID} x1={220} y1={184} x2={320} y2={230} />
      <ConnectorTls id={ID} x1={220} y1={268} x2={320} y2={300} />

    </svg>
  );
};
