import type React from 'react';
import { FILL_BLUE,STROKE_BLUE,STROKE_GREEN,TEXT,TEXT_DIM } from '../_shared';

// ─── Overview: two tab mockups side-by-side ───────────────────────

/**
 * Two browser-tab mockups showing the practical end-user payoff:
 * work two contexts in parallel without losing your place. Left tab
 * is a different workspace ("Production"); right tab is the same
 * workspace with a different layout (Environments expanded instead
 * of Rules). The point is concrete: each tab has its own focus, and
 * shared data (rule names) appears in both because storage syncs.
 */
export const MultiTabSyncDiagram: React.FC = () => {
  const tabBg = 'var(--ant-color-bg-container)';
  const tabBorder = 'var(--ant-color-border)';
  const headerBg = 'var(--ant-color-fill-secondary)';
  const sidebarBg = 'var(--ant-color-fill-quaternary)';
  const rowBg = 'var(--ant-color-fill-tertiary)';
  const activeFill = FILL_BLUE;
  const activeStroke = STROKE_BLUE;

  const renderTab = (xOffset: number, ordinal: string, workspace: string, mode: 'rules' | 'env') => {
    const x = xOffset;
    return (
      <g key={ordinal}>
        {/* Tab strip + title */}
        <rect x={x} y={26} width={146} height={18} rx={3} fill={headerBg} stroke={tabBorder} />
        <text x={x + 8} y={38} fontSize={9} fontWeight={600} fill={TEXT}>
          {ordinal} Open Headers
        </text>
        <circle cx={x + 138} cy={35} r={3} fill="var(--ant-color-text-quaternary)" />

        {/* App body */}
        <rect x={x} y={44} width={146} height={120} fill={tabBg} stroke={tabBorder} />

        {/* Top bar with workspace name */}
        <rect x={x} y={44} width={146} height={16} fill={headerBg} stroke="none" />
        <text x={x + 8} y={56} fontSize={9} fontWeight={600} fill={TEXT}>
          {workspace}
        </text>
        <circle cx={x + 132} cy={52} r={3} fill={STROKE_GREEN} />

        {/* Sidebar */}
        <rect x={x} y={60} width={44} height={104} fill={sidebarBg} stroke="none" />
        {/* Sidebar items */}
        {(['Rules', 'Requests', 'Env'] as const).map((label, i) => {
          const itemY = 68 + i * 18;
          const isActiveSidebar = (mode === 'rules' && label === 'Rules') || (mode === 'env' && label === 'Env');
          return (
            <g key={label}>
              {isActiveSidebar && (
                <rect x={x + 2} y={itemY - 6} width={40} height={14} rx={2} fill={activeFill} stroke={activeStroke} />
              )}
              <text x={x + 6} y={itemY + 3} fontSize={8} fontWeight={isActiveSidebar ? 600 : 400} fill={TEXT}>
                {label}
              </text>
            </g>
          );
        })}

        {/* Main content rows */}
        {mode === 'rules' &&
          ['Auth header', 'CORS bypass', 'Block ads'].map((row, i) => {
            const ry = 68 + i * 22;
            return (
              <g key={row}>
                <rect x={x + 50} y={ry - 6} width={92} height={16} rx={2} fill={rowBg} stroke={tabBorder} />
                <circle cx={x + 56} cy={ry + 1} r={2.5} fill={STROKE_GREEN} />
                <text x={x + 62} y={ry + 4} fontSize={8} fill={TEXT}>
                  {row}
                </text>
              </g>
            );
          })}
        {mode === 'env' && (
          <g>
            <text x={x + 50} y={68} fontSize={8} fontWeight={600} fill={TEXT}>
              staging
            </text>
            {['API_HOST', 'API_KEY', 'DEBUG'].map((k, i) => {
              const ry = 84 + i * 16;
              return (
                <g key={k}>
                  <rect x={x + 50} y={ry - 6} width={42} height={12} rx={2} fill={rowBg} stroke={tabBorder} />
                  <text x={x + 53} y={ry + 2} fontFamily="monospace" fontSize={7} fill={TEXT}>
                    {k}
                  </text>
                  <text x={x + 96} y={ry + 2} fontFamily="monospace" fontSize={7} fill={TEXT_DIM}>
                    ●●●●
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Pinned label under tab */}
        <text x={x + 73} y={180} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
          {mode === 'rules' ? 'Rules editor' : 'Env editor'}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Two workspace tabs open side by side — different workspaces or different layouts, working in parallel"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Two tabs, two contexts — at the same time
      </text>

      {renderTab(8, '#1', 'Production', 'rules')}
      {renderTab(166, '#2', 'Staging', 'env')}

      {/* Sync hint between the two tabs */}
      <line x1={154} y1={104} x2={166} y2={104} stroke={STROKE_GREEN} strokeWidth={1} strokeDasharray="2 2" />

      <text x={160} y={200} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Rules + collections sync through storage.
      </text>
      <text x={160} y={213} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Each tab keeps its own workspace + layout.
      </text>
    </svg>
  );
};
