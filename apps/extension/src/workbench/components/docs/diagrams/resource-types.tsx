/**
 * Resource Types — diagrams.
 *
 *   • ResourceTypesAnatomyDiagram — a stylised page mockup with
 *     coloured callouts pointing to each kind of resource that
 *     contributes a Chrome ResourceType value (Page, Frame, Script,
 *     CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other).
 *     Serves as the visual key the table below dives into.
 */

import type React from 'react';
import {
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

export const ResourceTypesAnatomyDiagram: React.FC = () => {
  // Locked color contract has fixed roles; for a reference like this
  // we tone them down by using both fill + accent text for each
  // resource type so the visual table stays readable even with the
  // overlapping color budget.
  const MAGENTA = '#c41d7f';
  const MAGENTA_BG = 'rgba(255, 22, 198, 0.10)';
  const VOLCANO = '#d4380d';
  const VOLCANO_BG = 'rgba(255, 85, 0, 0.10)';
  const GOLD = '#d48806';
  const GOLD_BG = 'rgba(250, 173, 20, 0.16)';
  const LIME = '#7cb305';
  const LIME_BG = 'rgba(160, 217, 17, 0.16)';
  const GEEK = '#1d39c4';
  const GEEK_BG = 'rgba(47, 84, 235, 0.10)';
  const CYAN = '#08979c';
  const CYAN_BG = 'rgba(19, 194, 194, 0.10)';

  // Page mockup geometry
  const PAGE_X = 14;
  const PAGE_Y = 28;
  const PAGE_W = 200;
  const PAGE_H = 290;

  return (
    <svg
      viewBox="0 0 320 340"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Resource Types anatomy — a stylised page mockup with callouts to each Chrome ResourceType: Page, Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Each kind of request maps to one ResourceType
      </text>

      {/* Outer page card */}
      <rect x={PAGE_X} y={PAGE_Y} width={PAGE_W} height={PAGE_H} rx={6} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} strokeWidth={1.5} />

      {/* Address bar — Page = main_frame */}
      <rect x={PAGE_X} y={PAGE_Y} width={PAGE_W} height={20} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={PAGE_X + 8} y={PAGE_Y + 14} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        https://openheaders.io
      </text>

      {/* Inside the page */}
      {/* Script tag */}
      <rect x={PAGE_X + 8} y={PAGE_Y + 28} width={84} height={14} rx={2} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={PAGE_X + 50} y={PAGE_Y + 38} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={STROKE_ORANGE}>
        {'<script>'}
      </text>

      {/* Stylesheet */}
      <rect x={PAGE_X + 100} y={PAGE_Y + 28} width={92} height={14} rx={2} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={PAGE_X + 146} y={PAGE_Y + 38} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={STROKE_PURPLE}>
        {'<link css>'}
      </text>

      {/* Image */}
      <rect x={PAGE_X + 8} y={PAGE_Y + 50} width={56} height={40} rx={2} fill={MAGENTA_BG} stroke={MAGENTA} />
      <text x={PAGE_X + 36} y={PAGE_Y + 74} textAnchor="middle" fontSize={9} fontWeight={700} fill={MAGENTA}>
        {'<img>'}
      </text>

      {/* Font (web font / @font-face) */}
      <rect x={PAGE_X + 72} y={PAGE_Y + 50} width={56} height={20} rx={2} fill={VOLCANO_BG} stroke={VOLCANO} />
      <text x={PAGE_X + 100} y={PAGE_Y + 64} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={VOLCANO}>
        @font-face
      </text>

      {/* Media (video/audio) */}
      <rect x={PAGE_X + 72} y={PAGE_Y + 74} width={56} height={16} rx={2} fill={GOLD_BG} stroke={GOLD} />
      <text x={PAGE_X + 100} y={PAGE_Y + 86} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={GOLD}>
        {'<video>'}
      </text>

      {/* Iframe (sub_frame) */}
      <rect x={PAGE_X + 136} y={PAGE_Y + 50} width={56} height={40} rx={2} fill={CYAN_BG} stroke={CYAN} strokeDasharray="3 2" />
      <text x={PAGE_X + 164} y={PAGE_Y + 68} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={CYAN}>
        {'<iframe>'}
      </text>
      <text x={PAGE_X + 164} y={PAGE_Y + 80} textAnchor="middle" fontSize={7} fontStyle="italic" fill={CYAN}>
        sub_frame
      </text>

      {/* Body content rows */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={PAGE_X + 8}
          y={PAGE_Y + 100 + i * 10}
          width={PAGE_W - 16 - i * 20}
          height={4}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}

      {/* Fetch / XHR + WebSocket + Ping rows — page-initiated requests */}
      <rect x={PAGE_X + 8} y={PAGE_Y + 140} width={184} height={18} rx={3} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={PAGE_X + 14} y={PAGE_Y + 153} fontFamily="monospace" fontSize={9} fontWeight={700} fill={STROKE_GREEN}>
        fetch('/api/users')
      </text>

      <rect x={PAGE_X + 8} y={PAGE_Y + 162} width={184} height={18} rx={3} fill={LIME_BG} stroke={LIME} />
      <text x={PAGE_X + 14} y={PAGE_Y + 175} fontFamily="monospace" fontSize={9} fontWeight={700} fill={LIME}>
        new WebSocket('wss://…')
      </text>

      <rect x={PAGE_X + 8} y={PAGE_Y + 184} width={184} height={18} rx={3} fill={GEEK_BG} stroke={GEEK} />
      <text x={PAGE_X + 14} y={PAGE_Y + 197} fontFamily="monospace" fontSize={9} fontWeight={700} fill={GEEK}>
        navigator.sendBeacon(…)
      </text>

      {/* Manifest / favicon — Other */}
      <rect x={PAGE_X + 8} y={PAGE_Y + 206} width={184} height={18} rx={3} fill="var(--ant-color-fill-secondary)" stroke="var(--ant-color-border)" />
      <text x={PAGE_X + 14} y={PAGE_Y + 219} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
        favicon, manifest, …
      </text>

      {/* Body page rows */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`bb-${i}`}
          x={PAGE_X + 8}
          y={PAGE_Y + 234 + i * 10}
          width={PAGE_W - 16 - i * 24}
          height={4}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}

      {/* Legend on the right side */}
      <text x={PAGE_X + PAGE_W + 16} y={PAGE_Y + 12} fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        LEGEND
      </text>

      {[
        { c: STROKE_BLUE, label: 'Page · main_frame' },
        { c: CYAN, label: 'Frame · sub_frame' },
        { c: STROKE_GREEN, label: 'Fetch/XHR' },
        { c: STROKE_ORANGE, label: 'Script' },
        { c: STROKE_PURPLE, label: 'CSS' },
        { c: MAGENTA, label: 'Image' },
        { c: VOLCANO, label: 'Font' },
        { c: GOLD, label: 'Media' },
        { c: LIME, label: 'WebSocket' },
        { c: GEEK, label: 'Ping' },
        { c: 'var(--ant-color-text-tertiary)', label: 'Other' },
      ].map((row, i) => {
        const y = PAGE_Y + 24 + i * 18;
        return (
          <g key={row.label}>
            <rect x={PAGE_X + PAGE_W + 16} y={y - 7} width={10} height={10} rx={2} fill={row.c} />
            <text x={PAGE_X + PAGE_W + 30} y={y + 1} fontSize={9} fill={TEXT}>
              {row.label}
            </text>
          </g>
        );
      })}

      <text x={160} y={332} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Each entry maps 1:1 — there's no overlap between rows.
      </text>
    </svg>
  );
};
