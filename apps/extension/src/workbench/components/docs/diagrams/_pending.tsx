/**
 * Pending diagrams — these belong to sections we haven't redone yet.
 * Each will move into its own per-section file (e.g.
 * `header-actions.tsx`) when we revisit the corresponding section.
 *
 * Until then, they live here so `index.ts` can re-export them and the
 * sections that already use them keep working unchanged.
 */

import type React from 'react';
import {
  ArrowDefs,
  Box,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

// ── Delay routing ────────────────────────────────────────────────

export const DelayRoutingDiagram: React.FC = () => (
  <svg
    viewBox="0 0 280 200"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Delay routing across navigation, fetch, and sub-resource lanes"
  >
    <ArrowDefs id="dl-arrow" />
    <Box x={95} y={10} w={90} h={32} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Matched request" />
    <line x1="140" y1="42" x2="140" y2="58" stroke={STROKE} strokeWidth="1.5" />
    <line x1="40" y1="58" x2="240" y2="58" stroke={STROKE} strokeWidth="1.5" />
    <line x1="40" y1="58" x2="40" y2="74" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#dl-arrow)" />
    <line x1="140" y1="58" x2="140" y2="74" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#dl-arrow)" />
    <line x1="240" y1="58" x2="240" y2="74" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#dl-arrow)" />
    <Box x={5} y={76} w={70} h={40} fill={FILL_GREEN} stroke={STROKE_GREEN} label="Document" sub="iframe nav" />
    <text x={40} y={130} textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
      ≤ 30,000 ms
    </text>
    <text x={40} y={143} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      via waiting page
    </text>
    <Box
      x={105}
      y={76}
      w={70}
      h={40}
      fill={FILL_PURPLE}
      stroke={STROKE_PURPLE}
      label="Fetch / XHR"
      sub="JS-initiated"
    />
    <text x={140} y={130} textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
      ≤ 5,000 ms
    </text>
    <text x={140} y={143} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      monkey-patched
    </text>
    <Box
      x={205}
      y={76}
      w={70}
      h={40}
      fill="var(--ant-color-fill-secondary)"
      stroke={STROKE}
      label="Sub-resource"
      sub="img / css / js"
    />
    <text x={240} y={130} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--ant-color-error)">
      not delayed
    </text>
    <text x={240} y={143} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      passes through
    </text>
    <text x={140} y={180} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      Higher caps require a real local proxy
    </text>
  </svg>
);



