import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, BrowserWindow, FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN } from './_shared';

/**
 * Roadmap — Local / LAN daemon for cross-device sync.
 *
 * Hub-and-spoke: daemon in the center (multi-stack purple block), three
 * client cards around it (extension on laptop, desktop on workstation,
 * CLI on third device). All connect through LAN — explicitly not cloud.
 */
export const RoadmapDaemonDiagram: React.FC = () => {
  const t = useT();
  const ID = 'rm-daemon';
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const DAEMON_W = 150;
  const DAEMON_H = 92;
  const DAEMON_X = (W - DAEMON_W) / 2;
  const DAEMON_Y = 78;

  const CLIENT_W = 132;
  const CLIENT_H = 56;
  const CHROME_H = 20;
  const ROW1_Y = DAEMON_Y - 8;
  const ROW2_Y = DAEMON_Y + DAEMON_H + 18;

  const VERDICT_Y = ROW2_Y + CLIENT_H + 16;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  const renderClient = (x: number, y: number, title: string, sideLabel: string, surfaces: string) => (
    <g>
      {/* Side label above the chrome — keeps the chrome itself uncrowded */}
      <text x={x + CLIENT_W / 2} y={y - 5} textAnchor="middle" fontSize={8.5} fontStyle="italic" fill={TEXT_DIM}>
        {sideLabel}
      </text>
      <BrowserWindow x={x} y={y} w={CLIENT_W} h={CLIENT_H} chromeH={CHROME_H} title={title}>
        <text
          x={x + CLIENT_W / 2}
          y={y + CHROME_H + 22}
          textAnchor="middle"
          fontSize={9}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {surfaces}
        </text>
      </BrowserWindow>
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.openHeaders.roadmapDaemon.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.roadmapDaemon.title')}
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.roadmapDaemon.subtitle')}
      </text>

      {/* Daemon block — multi-stack rectangles */}
      <rect
        x={DAEMON_X}
        y={DAEMON_Y}
        width={DAEMON_W}
        height={DAEMON_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_PURPLE}
        strokeWidth={1.5}
      />
      <rect x={DAEMON_X} y={DAEMON_Y} width={DAEMON_W} height={22} rx={6} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text
        x={DAEMON_X + DAEMON_W / 2}
        y={DAEMON_Y + 15}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        {t('workbench.docs.diagrams.openHeaders.shared.localDaemon')}
      </text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={DAEMON_X + 10}
            y={DAEMON_Y + 32 + i * 16}
            width={DAEMON_W - 20}
            height={12}
            rx={2}
            fill={FILL_PURPLE}
            stroke={STROKE_PURPLE}
            strokeWidth={0.8}
          />
          <circle cx={DAEMON_X + 16} cy={DAEMON_Y + 38 + i * 16} r={1.8} fill={OH_GREEN} />
          <text x={DAEMON_X + 26} y={DAEMON_Y + 41 + i * 16} fontFamily="monospace" fontSize={8} fill={TEXT}>
            {
              [
                t('workbench.docs.diagrams.openHeaders.roadmapDaemon.stackWorkspaces'),
                t('workbench.docs.diagrams.openHeaders.roadmapDaemon.stackRules'),
                t('workbench.docs.diagrams.openHeaders.roadmapDaemon.stackSync'),
              ][i]
            }
          </text>
        </g>
      ))}
      <text
        x={DAEMON_X + DAEMON_W / 2}
        y={DAEMON_Y + DAEMON_H - 4}
        textAnchor="middle"
        fontSize={8.5}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {t('workbench.docs.diagrams.openHeaders.roadmapDaemon.lanReachable')}
      </text>

      {/* Three clients */}
      {renderClient(
        14,
        ROW1_Y,
        t('workbench.docs.diagrams.openHeaders.roadmapDaemon.clientExtension'),
        t('workbench.docs.diagrams.openHeaders.roadmapDaemon.sideLaptop'),
        t('workbench.docs.diagrams.openHeaders.roadmapDaemon.surfExtension'),
      )}
      {renderClient(
        W - CLIENT_W - 14,
        ROW1_Y,
        t('workbench.docs.diagrams.openHeaders.shared.desktopApp'),
        t('workbench.docs.diagrams.openHeaders.roadmapDaemon.sideWorkstation'),
        t('workbench.docs.diagrams.openHeaders.roadmapDaemon.surfDesktop'),
      )}
      {renderClient(
        (W - CLIENT_W) / 2,
        ROW2_Y,
        'CLI',
        '',
        t('workbench.docs.diagrams.openHeaders.roadmapDaemon.surfCli'),
      )}

      {/* Connection lines */}
      {[
        { x1: 14 + CLIENT_W, y1: ROW1_Y + CLIENT_H / 2, x2: DAEMON_X, y2: DAEMON_Y + DAEMON_H / 2 },
        { x1: W - CLIENT_W - 14, y1: ROW1_Y + CLIENT_H / 2, x2: DAEMON_X + DAEMON_W, y2: DAEMON_Y + DAEMON_H / 2 },
        { x1: CX, y1: ROW2_Y, x2: CX, y2: DAEMON_Y + DAEMON_H },
      ].map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={OH_GREEN}
          strokeWidth={1.4}
          markerEnd={`url(#${ID})`}
        />
      ))}

      {/* Verdict */}
      <rect
        x={12}
        y={VERDICT_Y}
        width={W - 24}
        height={VERDICT_H}
        rx={5}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text x={CX} y={VERDICT_Y + VERDICT_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.roadmapDaemon.verdict')}
      </text>
    </svg>
  );
};
