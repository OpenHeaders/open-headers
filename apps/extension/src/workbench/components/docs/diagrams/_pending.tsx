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

// ── Inject timing relative to page parse ─────────────────────────

export const InjectTimingDiagram: React.FC = () => (
  <svg
    viewBox="0 0 280 140"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Inject script insertion timing diagram"
  >
    <ArrowDefs id="inj-arrow" />
    <line x1="20" y1="80" x2="260" y2="80" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#inj-arrow)" />
    <text x={260} y={94} textAnchor="end" fontSize="9" fill={TEXT_DIM}>
      time →
    </text>
    <circle cx="60" cy="80" r="3" fill={STROKE} />
    <text x={60} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      navigation
    </text>
    <circle cx="140" cy="80" r="3" fill={STROKE} />
    <text x={140} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      DOM parsed
    </text>
    <circle cx="220" cy="80" r="3" fill={STROKE} />
    <text x={220} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      load event
    </text>
    <rect x={50} y={30} width={50} height={30} rx={4} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
    <text x={75} y={48} textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      ASAP
    </text>
    <text x={75} y={20} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      pre-page-script
    </text>
    <rect x={205} y={30} width={50} height={30} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
    <text x={230} y={48} textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      After Load
    </text>
    <text x={230} y={20} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      DOM-safe
    </text>
    <line x1="75" y1="60" x2="60" y2="78" stroke={STROKE} strokeWidth="1" strokeDasharray="2 2" />
    <line x1="230" y1="60" x2="220" y2="78" stroke={STROKE} strokeWidth="1" strokeDasharray="2 2" />
    <text x={140} y={130} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      Pick ASAP to win monkey-patch races; After Load for DOM reads
    </text>
  </svg>
);

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



