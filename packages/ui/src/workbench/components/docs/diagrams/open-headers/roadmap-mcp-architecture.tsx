import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Roadmap — MCP Server (architecture).
 *
 * Left-to-right wiring: AI client (Claude Desktop, Cursor, Cline, etc.)
 * → MCP transport (stdio for local, HTTP/SSE for remote) → Open Headers
 * MCP server. Below the server, an arrow drops into the Workbench
 * showing the mutation actually lands on the user's workspace. The
 * point: any MCP client reaches the same workspace through one open
 * protocol.
 */
export const RoadmapMcpArchitectureDiagram: React.FC = () => {
  const t = useT();
  const ID = 'rm-mcp-arch';
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const NODE_Y = 64;
  const NODE_H = 138;
  const NODE_W = 138;
  const CHROME_H = 22;
  const CLIENT_X = 14;
  const SERVER_X = W - NODE_W - 14;
  const MID_X = CLIENT_X + NODE_W;
  const MID_W = SERVER_X - MID_X;

  const WB_Y = NODE_Y + NODE_H + 42;
  const WB_W = 320;
  const WB_H = 72;
  const WB_X = (W - WB_W) / 2;

  const VERDICT_Y = WB_Y + WB_H + 18;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  const CLIENTS = ['Claude Desktop', 'Claude Code', 'Cursor', 'VS Code', 'Cline · …'];

  const renderWindow = (
    x: number,
    title: string,
    sideTag: string,
    body: React.ReactNode,
    accent: 'blue' | 'green' = 'blue',
  ) => {
    const stroke = accent === 'green' ? OH_GREEN : STROKE_BLUE;
    return (
      <g>
        {/* Side tag rendered ABOVE the chrome so chrome stays uncrowded */}
        <text x={x + NODE_W / 2} y={NODE_Y - 6} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
          {sideTag}
        </text>
        <rect
          x={x}
          y={NODE_Y}
          width={NODE_W}
          height={NODE_H}
          rx={8}
          fill="var(--ant-color-bg-container)"
          stroke={stroke}
          strokeWidth={accent === 'green' ? 1.8 : 1.4}
        />
        <rect
          x={x}
          y={NODE_Y}
          width={NODE_W}
          height={CHROME_H}
          rx={8}
          fill="var(--ant-color-fill-secondary)"
          stroke={stroke}
        />
        <circle cx={x + 10} cy={NODE_Y + CHROME_H / 2} r={3.5} fill="#ff5f57" />
        <circle cx={x + 20} cy={NODE_Y + CHROME_H / 2} r={3.5} fill="#febc2e" />
        <circle cx={x + 30} cy={NODE_Y + CHROME_H / 2} r={3.5} fill="#28c840" />
        <text
          x={x + NODE_W / 2 + 14}
          y={NODE_Y + CHROME_H / 2 + 4}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={TEXT}
        >
          {title}
        </text>
        {body}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.openHeaders.mcpArch.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.mcpArch.title')}
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.mcpArch.subtitle')}
      </text>

      {/* AI client window */}
      {renderWindow(
        CLIENT_X,
        t('workbench.docs.diagrams.openHeaders.mcpArch.clientTitle'),
        t('workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag'),
        <g>
          <text
            x={CLIENT_X + 12}
            y={NODE_Y + CHROME_H + 16}
            fontSize={9}
            fontWeight={800}
            fill={TEXT_DIM}
            letterSpacing={0.4}
          >
            {t('workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient')}
          </text>
          {CLIENTS.map((name, i) => (
            <g key={name}>
              <circle cx={CLIENT_X + 14} cy={NODE_Y + CHROME_H + 32 + i * 16} r={2} fill={STROKE_BLUE} />
              <text x={CLIENT_X + 22} y={NODE_Y + CHROME_H + 35 + i * 16} fontSize={10} fontWeight={600} fill={TEXT}>
                {name}
              </text>
            </g>
          ))}
        </g>,
      )}

      {/* MCP middle — small protocol pill, leaving real arrow space */}
      {(() => {
        const midCx = MID_X + MID_W / 2;
        const pillW = 64;
        const pillX = midCx - pillW / 2;
        const pillY = NODE_Y + 38;
        const pillH = 28;
        const arrowY = pillY + pillH / 2;
        return (
          <g>
            {/* In-arrow */}
            <line
              x1={CLIENT_X + NODE_W + 2}
              y1={arrowY}
              x2={pillX - 2}
              y2={arrowY}
              stroke={STROKE_PURPLE}
              strokeWidth={1.6}
              markerEnd={`url(#${ID})`}
            />
            {/* Protocol pill */}
            <rect
              x={pillX}
              y={pillY}
              width={pillW}
              height={pillH}
              rx={pillH / 2}
              fill={FILL_PURPLE}
              stroke={STROKE_PURPLE}
              strokeWidth={1.4}
            />
            <text x={midCx} y={pillY + pillH / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={TEXT}>
              MCP
            </text>
            {/* Transport labels */}
            <text
              x={midCx}
              y={pillY + pillH + 16}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={STROKE_PURPLE}
            >
              stdio
            </text>
            <text x={midCx} y={pillY + pillH + 27} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {t('workbench.docs.diagrams.openHeaders.mcpArch.transportLocal')}
            </text>
            <text
              x={midCx}
              y={pillY + pillH + 46}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={STROKE_PURPLE}
            >
              HTTP / SSE
            </text>
            <text x={midCx} y={pillY + pillH + 57} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {t('workbench.docs.diagrams.openHeaders.mcpArch.transportRemote')}
            </text>
            {/* Out-arrow */}
            <line
              x1={pillX + pillW + 2}
              y1={arrowY}
              x2={SERVER_X - 2}
              y2={arrowY}
              stroke={STROKE_PURPLE}
              strokeWidth={1.6}
              markerEnd={`url(#${ID})`}
            />
          </g>
        );
      })()}

      {/* OH MCP Server window */}
      {renderWindow(
        SERVER_X,
        t('workbench.docs.diagrams.openHeaders.mcpArch.serverTitle'),
        t('workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders'),
        <g>
          <text
            x={SERVER_X + 12}
            y={NODE_Y + CHROME_H + 16}
            fontSize={9}
            fontWeight={800}
            fill={OH_GREEN}
            letterSpacing={0.4}
          >
            {t('workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes')}
          </text>
          {[
            t('workbench.docs.diagrams.openHeaders.mcpArch.exposeRules'),
            t('workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests'),
            t('workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments'),
            t('workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables'),
            t('workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows'),
          ].map((tool, i) => (
            <g key={tool}>
              <circle cx={SERVER_X + 14} cy={NODE_Y + CHROME_H + 32 + i * 16} r={2} fill={OH_GREEN} />
              <text x={SERVER_X + 22} y={NODE_Y + CHROME_H + 35 + i * 16} fontSize={10} fontWeight={600} fill={TEXT}>
                {tool}
              </text>
            </g>
          ))}
        </g>,
        'green',
      )}

      {/* Arrow from server down to workbench */}
      <line
        x1={SERVER_X + NODE_W / 2}
        y1={NODE_Y + NODE_H + 2}
        x2={WB_X + WB_W * 0.7}
        y2={WB_Y - 2}
        stroke={OH_GREEN}
        strokeWidth={1.6}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={(SERVER_X + NODE_W / 2 + WB_X + WB_W * 0.7) / 2 + 26}
        y={(NODE_Y + NODE_H + WB_Y) / 2}
        fontSize={9}
        fontStyle="italic"
        fontWeight={700}
        fill={OH_GREEN}
      >
        {t('workbench.docs.diagrams.openHeaders.mcpArch.mutates')}
      </text>

      {/* Workbench card */}
      <rect
        x={WB_X}
        y={WB_Y}
        width={WB_W}
        height={WB_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.4}
      />
      <rect
        x={WB_X}
        y={WB_Y}
        width={WB_W}
        height={CHROME_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE_BLUE}
      />
      <circle cx={WB_X + 12} cy={WB_Y + CHROME_H / 2} r={4} fill="#ff5f57" />
      <circle cx={WB_X + 24} cy={WB_Y + CHROME_H / 2} r={4} fill="#febc2e" />
      <circle cx={WB_X + 36} cy={WB_Y + CHROME_H / 2} r={4} fill="#28c840" />
      <text x={WB_X + 50} y={WB_Y + CHROME_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.mcpArch.wbTitle')}
      </text>
      <text
        x={WB_X + WB_W - 10}
        y={WB_Y + CHROME_H / 2 + 4}
        textAnchor="end"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {t('workbench.docs.diagrams.openHeaders.mcpArch.wbLive')}
      </text>
      {/* Workspace contents row */}
      <rect
        x={WB_X + 10}
        y={WB_Y + CHROME_H + 8}
        width={WB_W - 20}
        height={28}
        rx={4}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
      />
      <text x={WB_X + WB_W / 2} y={WB_Y + CHROME_H + 26} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.mcpArch.wbContents')}
      </text>

      {/* Verdict */}
      <rect
        x={12}
        y={VERDICT_Y}
        width={W - 24}
        height={VERDICT_H}
        rx={5}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeWidth={1.5}
      />
      <text x={CX} y={VERDICT_Y + VERDICT_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={OH_GREEN}>
        {t('workbench.docs.diagrams.openHeaders.mcpArch.verdict')}
      </text>
    </svg>
  );
};
