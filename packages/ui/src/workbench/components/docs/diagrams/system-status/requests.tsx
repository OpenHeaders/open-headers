import type React from 'react';
import { ArrowDefs,FILL_BLUE,STROKE,STROKE_BLUE,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS_BG,WARNING_BG,GREY,GREY_BG,BORDER,FILL_SECONDARY,BG_CONTAINER,dotColor } from './_shared';

/**
 * Outcomes: clarifies the surprising-but-correct rule that ANY HTTP
 * response (including 4xx/5xx) flips the pill green. The pill goes
 * yellow only when the request never produced a response — network
 * offline, DNS failure, abort. Two columns of example outcomes make
 * the distinction visual.
 */
export const RequestExecutorOutcomesDiagram: React.FC = () => {
  const ID = 'req-out';
  const errBorder = 'var(--ant-color-error-border)';

  const GREEN_EXAMPLES = [
    { status: '200', text: 'OK' },
    { status: '404', text: 'Not Found' },
    { status: '500', text: 'Server Error' },
  ];
  const YELLOW_EXAMPLES = [
    { status: '—', text: 'NetworkError' },
    { status: '—', text: 'Aborted' },
    { status: '—', text: 'Offline / DNS' },
  ];

  return (
    <svg
      viewBox="0 0 320 280"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Request executor outcomes — any HTTP response, including 4xx and 5xx, turns the pill green. Only network-level failures with no response turn it yellow."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        What turns the Requests pill which color?
      </text>

      {/* Source: Send button card */}
      <rect x={100} y={30} width={120} height={36} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={160} y={45} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Request editor
      </text>
      <rect x={140} y={51} width={40} height={12} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={60} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
        Send ▸
      </text>

      {/* Arrow down to executor */}
      <line x1={160} y1={66} x2={160} y2={82} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Executor box */}
      <rect x={120} y={84} width={80} height={22} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={160} y={99} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Executor fires
      </text>

      {/* Split arrows down to two outcomes */}
      <line x1={150} y1={106} x2={80} y2={130} stroke={dotColor('green')} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <line
        x1={170}
        y1={106}
        x2={240}
        y2={130}
        stroke={dotColor('yellow')}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />

      {/* LEFT column — got HTTP response */}
      <rect x={10} y={132} width={140} height={130} rx={6} fill={SUCCESS_BG} stroke={dotColor('green')} />
      <text x={80} y={148} textAnchor="middle" fontSize={10} fontWeight={700} fill={dotColor('green')}>
        ✓ got HTTP response
      </text>
      <text x={80} y={161} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        any status code counts
      </text>
      {GREEN_EXAMPLES.map((ex, i) => {
        const ry = 174 + i * 22;
        return (
          <g key={ex.text}>
            <rect x={18} y={ry} width={124} height={18} rx={3} fill={BG_CONTAINER} stroke={dotColor('green')} />
            <rect x={22} y={ry + 2} width={28} height={14} rx={2} fill={SUCCESS_BG} stroke={dotColor('green')} />
            <text
              x={36}
              y={ry + 13}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={9}
              fontWeight={700}
              fill={TEXT}
            >
              {ex.status}
            </text>
            <text x={56} y={ry + 13} fontSize={9} fill={TEXT}>
              {ex.text}
            </text>
          </g>
        );
      })}
      <text x={80} y={252} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('green')}>
        Pill → green
      </text>

      {/* RIGHT column — network failure */}
      <rect x={170} y={132} width={140} height={130} rx={6} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <text x={240} y={148} textAnchor="middle" fontSize={10} fontWeight={700} fill={dotColor('yellow')}>
        ✗ no response
      </text>
      <text x={240} y={161} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        network-level failure
      </text>
      {YELLOW_EXAMPLES.map((ex, i) => {
        const ry = 174 + i * 22;
        return (
          <g key={ex.text}>
            <rect
              x={178}
              y={ry}
              width={124}
              height={18}
              rx={3}
              fill={BG_CONTAINER}
              stroke={errBorder}
              strokeDasharray="2 2"
            />
            <text x={184} y={ry + 13} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
              {ex.status}
            </text>
            <text x={200} y={ry + 13} fontSize={9} fill={TEXT}>
              {ex.text}
            </text>
          </g>
        );
      })}
      <text x={240} y={252} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('yellow')}>
        Pill → yellow
      </text>

      <text x={160} y={274} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        A 500 is still "green" — the request completed, you just got a 500.
      </text>
    </svg>
  );
};

/**
 * Scope: not every request updates the pill. Only ad-hoc Send-button
 * requests from the editor do. Live workflow refreshes pass
 * `silentStatus: true` so they don't spam the pill, and webpage
 * traffic (DNR / monkey-patched fetch) flows through a different
 * system entirely.
 */
export const RequestExecutorScopeDiagram: React.FC = () => {
  type Row = { source: string; sub: string; updates: boolean; reason: string };
  const ROWS: Row[] = [
    {
      source: 'Send ▸ in Request editor',
      sub: 'user-initiated',
      updates: true,
      reason: 'updates pill',
    },
    {
      source: 'Live workflow refresh',
      sub: 'background tick',
      updates: false,
      reason: 'silentStatus: true',
    },
    {
      source: 'Webpage fetch / XHR',
      sub: 'observed by Rules engine',
      updates: false,
      reason: 'different system',
    },
  ];

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Request executor scope — only Send-button requests update the pill. Live workflow refreshes are silent; webpage traffic uses the Rules engine instead."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        What updates the Requests pill?
      </text>

      {ROWS.map((row, i) => {
        const y = 36 + i * 50;
        const fill = row.updates ? SUCCESS_BG : GREY_BG;
        const stroke = row.updates ? dotColor('green') : GREY;
        return (
          <g key={row.source}>
            {/* Source card */}
            <rect x={10} y={y} width={150} height={40} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
            <text x={20} y={y + 16} fontSize={10} fontWeight={700} fill={TEXT}>
              {row.source}
            </text>
            <text x={20} y={y + 30} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {row.sub}
            </text>

            {/* Arrow + status */}
            <line
              x1={160}
              y1={y + 20}
              x2={188}
              y2={y + 20}
              stroke={row.updates ? dotColor('green') : GREY}
              strokeWidth={1.5}
              strokeDasharray={row.updates ? undefined : '3 2'}
              markerEnd="url(#sse-marker)"
            />

            {/* Result pill */}
            <rect x={190} y={y + 8} width={120} height={24} rx={4} fill={fill} stroke={stroke} />
            {row.updates ? (
              <>
                <circle cx={200} cy={y + 20} r={3.5} fill={dotColor('green')} />
                <text x={210} y={y + 24} fontSize={9} fontWeight={700} fill={TEXT}>
                  {row.reason}
                </text>
              </>
            ) : (
              <>
                <text x={200} y={y + 24} fontSize={11} fontWeight={700} fill={GREY}>
                  ✗
                </text>
                <text x={214} y={y + 18} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
                  no update
                </text>
                <text x={214} y={y + 28} fontFamily="monospace" fontSize={7} fill={TEXT_DIM}>
                  {row.reason}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* arrow marker (local) */}
      <defs>
        <marker id="sse-marker" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE} />
        </marker>
      </defs>

      <text x={160} y={194} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Only ad-hoc Send-button traffic shapes this pill.
      </text>
    </svg>
  );
};

// ─── Permissions subsystem — silent no-op + audit ─────────────────

