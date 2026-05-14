import type React from 'react';
import { ArrowDefs, FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Roadmap — Team workspaces via Git.
 *
 * Y-shape: two devices on top (browser-window cards), a Git repo card
 * below centered. Each device has a diagonal arrow down into the repo
 * (push from A, pull to B) so the lines have real visual length and
 * never overlap the card frames.
 */
export const RoadmapGitWorkspacesDiagram: React.FC = () => {
  const ID = 'rm-git';
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const DEVICE_W = 156;
  const DEVICE_H = 92;
  const DEVICE_Y = 64;
  const DEVICE_LEFT_X = 18;
  const DEVICE_RIGHT_X = W - DEVICE_W - 18;
  const CHROME_H = 22;

  const REPO_W = 240;
  const REPO_H = 102;
  const REPO_X = (W - REPO_W) / 2;
  const REPO_Y = DEVICE_Y + DEVICE_H + 36;

  const VERDICT_Y = REPO_Y + REPO_H + 16;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  const renderDevice = (x: number, label: string, sideLabel: string) => (
    <g>
      <text x={x + DEVICE_W / 2} y={DEVICE_Y - 6} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {sideLabel}
      </text>
      <rect
        x={x}
        y={DEVICE_Y}
        width={DEVICE_W}
        height={DEVICE_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.4}
      />
      <rect
        x={x}
        y={DEVICE_Y}
        width={DEVICE_W}
        height={CHROME_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE_BLUE}
      />
      <circle cx={x + 10} cy={DEVICE_Y + CHROME_H / 2} r={3.5} fill="#ff5f57" />
      <circle cx={x + 20} cy={DEVICE_Y + CHROME_H / 2} r={3.5} fill="#febc2e" />
      <circle cx={x + 30} cy={DEVICE_Y + CHROME_H / 2} r={3.5} fill="#28c840" />
      <text
        x={x + DEVICE_W / 2 + 12}
        y={DEVICE_Y + CHROME_H / 2 + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        {label}
      </text>
      {/* Inner workspace pill */}
      <rect
        x={x + 10}
        y={DEVICE_Y + CHROME_H + 12}
        width={DEVICE_W - 20}
        height={42}
        rx={5}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
      />
      <text
        x={x + DEVICE_W / 2}
        y={DEVICE_Y + CHROME_H + 28}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        Workspace
      </text>
      <text
        x={x + DEVICE_W / 2}
        y={DEVICE_Y + CHROME_H + 42}
        textAnchor="middle"
        fontSize={8.5}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        rules · environments · vault
      </text>
    </g>
  );

  // Anchor points for diagonal arrows.
  const leftDeviceBottomX = DEVICE_LEFT_X + DEVICE_W / 2;
  const leftDeviceBottomY = DEVICE_Y + DEVICE_H + 2;
  const rightDeviceBottomX = DEVICE_RIGHT_X + DEVICE_W / 2;
  const rightDeviceBottomY = DEVICE_Y + DEVICE_H + 2;
  const repoLeftTopX = REPO_X + 36;
  const repoRightTopX = REPO_X + REPO_W - 36;
  const repoTopY = REPO_Y - 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="Roadmap milestone — Team workspaces via Git. Two devices each hold a workspace; both push to and pull from a shared Git repository. The repo is the sync layer; no vendor server in the middle."
    >
      <ArrowDefs id={ID} />

      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Workspaces as Git repositories
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Pull syncs · push shares · merge through Git — no vendor server.
      </text>

      {renderDevice(DEVICE_LEFT_X, 'Workbench', 'device A')}
      {renderDevice(DEVICE_RIGHT_X, 'Workbench', 'device B')}

      {/* Diagonal arrows: device A → repo (push), repo → device B (pull) */}
      <line
        x1={leftDeviceBottomX}
        y1={leftDeviceBottomY}
        x2={repoLeftTopX}
        y2={repoTopY}
        stroke={OH_GREEN}
        strokeWidth={1.6}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={(leftDeviceBottomX + repoLeftTopX) / 2 - 10}
        y={(leftDeviceBottomY + repoTopY) / 2 + 4}
        textAnchor="end"
        fontSize={10}
        fontStyle="italic"
        fontWeight={700}
        fill={OH_GREEN}
      >
        push
      </text>

      <line
        x1={repoRightTopX}
        y1={repoTopY}
        x2={rightDeviceBottomX}
        y2={rightDeviceBottomY}
        stroke={OH_GREEN}
        strokeWidth={1.6}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={(repoRightTopX + rightDeviceBottomX) / 2 + 10}
        y={(repoTopY + rightDeviceBottomY) / 2 + 4}
        fontSize={10}
        fontStyle="italic"
        fontWeight={700}
        fill={OH_GREEN}
      >
        pull
      </text>

      {/* Git repo card */}
      <rect
        x={REPO_X}
        y={REPO_Y}
        width={REPO_W}
        height={REPO_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={OH_GREEN}
        strokeWidth={1.6}
      />
      <rect x={REPO_X} y={REPO_Y} width={REPO_W} height={24} rx={6} fill={OH_GREEN_TINT} stroke={OH_GREEN} />
      <text x={REPO_X + REPO_W / 2} y={REPO_Y + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={OH_GREEN}>
        ⎇ workspace.git
      </text>
      {/* Commit log */}
      {[
        { sha: 'a1f2', msg: 'add staging env' },
        { sha: 'e3d4', msg: 'tweak headers rule' },
        { sha: 'c9b0', msg: 'initial workspace' },
      ].map((c, i) => (
        <g key={c.sha}>
          <circle cx={REPO_X + 18} cy={REPO_Y + 40 + i * 20} r={3} fill={OH_GREEN} />
          {i < 2 && (
            <line
              x1={REPO_X + 18}
              y1={REPO_Y + 40 + i * 20 + 3}
              x2={REPO_X + 18}
              y2={REPO_Y + 40 + (i + 1) * 20 - 3}
              stroke={OH_GREEN}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          )}
          <text
            x={REPO_X + 30}
            y={REPO_Y + 44 + i * 20}
            fontFamily="monospace"
            fontSize={9}
            fontWeight={700}
            fill={TEXT}
          >
            {c.sha}
          </text>
          <text x={REPO_X + 64} y={REPO_Y + 44 + i * 20} fontSize={9} fill={TEXT_DIM}>
            {c.msg}
          </text>
        </g>
      ))}

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
        Your data, your repo, your auditable history
      </text>
    </svg>
  );
};
