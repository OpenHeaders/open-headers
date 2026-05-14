import type React from 'react';
import { ArrowDefs,STROKE,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS_BG,WARNING_BG,ERROR_BG,BORDER,FILL_SECONDARY,BG_CONTAINER,dotColor } from './_shared';

/**
 * Hydration: on SW wake, the vault blob loads from chrome.storage,
 * and every entry runs through the workspace schema. Matches are
 * kept; drift entries are dropped + logged + reported as yellow.
 * Three concrete rows make the keep/drop outcome visible at a glance.
 */
export const VaultHydrationDiagram: React.FC = () => {
  const ID = 'vault-hyd';
  const errBorder = 'var(--ant-color-error-border)';

  type Entry = { uid: string; ok: boolean; reason?: string };
  const ENTRIES: Entry[] = [
    { uid: 'sec_a1f3', ok: true },
    { uid: 'sec_b2c4', ok: true },
    { uid: 'sec_c3d5', ok: false, reason: 'old shape' },
  ];

  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Vault hydration — vault blob loads from storage, every entry runs through the schema. Matches are kept; drift entries are dropped and reported as yellow."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Vault hydrate on SW wake
      </text>

      {/* Storage source */}
      <rect x={20} y={32} width={280} height={40} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={32} y={48} fontSize={9} fontWeight={700} fill={TEXT}>
        chrome.storage.local
      </text>
      <text x={32} y={62} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        oh.ws.{'<id>'}.vault (encrypted blob)
      </text>
      <rect x={234} y={42} width={56} height={20} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={262} y={56} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        ENC
      </text>

      {/* Arrow down to validator */}
      <line x1={160} y1={72} x2={160} y2={88} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Validator box */}
      <rect x={100} y={90} width={120} height={24} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={160} y={105} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Schema validator
      </text>

      {/* Arrow down to entries */}
      <line x1={160} y1={114} x2={160} y2={128} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Three concrete entries */}
      {ENTRIES.map((entry, i) => {
        const y = 132 + i * 26;
        const fill = entry.ok ? SUCCESS_BG : ERROR_BG;
        const stroke = entry.ok ? dotColor('green') : errBorder;
        return (
          <g key={entry.uid}>
            <rect x={20} y={y} width={184} height={22} rx={3} fill={fill} stroke={stroke} />
            <text x={32} y={y + 14} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
              {entry.uid}
            </text>
            <text x={120} y={y + 14} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {entry.ok ? 'matches schema' : `drift: ${entry.reason}`}
            </text>
            {/* Outcome arrow */}
            <line
              x1={206}
              y1={y + 11}
              x2={228}
              y2={y + 11}
              stroke={entry.ok ? dotColor('green') : errBorder}
              strokeWidth={1.5}
              strokeDasharray={entry.ok ? undefined : '2 2'}
              markerEnd={`url(#${ID})`}
            />
            {/* Outcome badge */}
            <rect
              x={232}
              y={y + 2}
              width={68}
              height={18}
              rx={3}
              fill={entry.ok ? SUCCESS_BG : WARNING_BG}
              stroke={dotColor(entry.ok ? 'green' : 'yellow')}
            />
            <text x={266} y={y + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
              {entry.ok ? '✓ kept' : '✗ dropped'}
            </text>
          </g>
        );
      })}

      {/* Status pill marker for the drift case */}
      <line
        x1={266}
        y1={206}
        x2={266}
        y2={224}
        stroke={dotColor('yellow')}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <rect x={222} y={224} width={88} height={18} rx={4} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <circle cx={232} cy={233} r={3} fill={dotColor('yellow')} />
      <text x={272} y={236} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Secrets · yellow
      </text>

      <text x={20} y={234} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        kept entries
      </text>
      <text x={20} y={246} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        hydrate cleanly
      </text>
    </svg>
  );
};

/**
 * Drift detail: what "doesn't match the current shape" actually looks
 * like. Two side-by-side cards — left valid, right invalid — with the
 * offending field highlighted. Beginners need to see drift concretely
 * before "Schema drift" reads as anything but jargon.
 */
export const VaultDriftDetailDiagram: React.FC = () => {
  const errBorder = 'var(--ant-color-error-border)';
  const errBg = 'var(--ant-color-error-bg)';
  const errColor = dotColor('red');

  const Card = ({
    xOff,
    title,
    accent,
    accentStroke,
    fields,
    issue,
  }: {
    xOff: number;
    title: string;
    accent: string;
    accentStroke: string;
    fields: { key: string; value: string; ok?: boolean; missing?: boolean }[];
    issue?: string;
  }) => (
    <g>
      <rect x={xOff} y={30} width={140} height={150} rx={4} fill={BG_CONTAINER} stroke={accentStroke} />
      <rect x={xOff} y={30} width={140} height={20} rx={4} fill={accent} stroke={accentStroke} />
      <circle cx={xOff + 12} cy={40} r={3.5} fill={accentStroke} />
      <text x={xOff + 22} y={43} fontSize={10} fontWeight={700} fill={TEXT}>
        {title}
      </text>
      {fields.map((f, i) => {
        const fy = 64 + i * 22;
        const fieldOk = f.ok !== false && !f.missing;
        const fillRow = fieldOk ? 'transparent' : errBg;
        return (
          <g key={f.key}>
            {!fieldOk && (
              <rect x={xOff + 6} y={fy - 12} width={128} height={20} rx={2} fill={fillRow} stroke={errBorder} />
            )}
            <text x={xOff + 12} y={fy} fontFamily="monospace" fontSize={8} fontWeight={700} fill={TEXT}>
              {f.key}:
            </text>
            <text
              x={xOff + 64}
              y={fy}
              fontFamily="monospace"
              fontSize={8}
              fill={f.missing ? errColor : TEXT}
              fontStyle={f.missing ? 'italic' : undefined}
            >
              {f.missing ? '— missing —' : f.value}
            </text>
          </g>
        );
      })}
      {issue && (
        <text x={xOff + 70} y={166} textAnchor="middle" fontSize={8} fontStyle="italic" fill={errColor}>
          {issue}
        </text>
      )}
    </g>
  );

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="What schema drift actually looks like — a valid entry has uid, label, and cipher; a drift entry might be missing the cipher field. The validator drops the bad row and emits a yellow status."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        What "schema drift" actually looks like
      </text>

      <Card
        xOff={10}
        title="Valid entry"
        accent={SUCCESS_BG}
        accentStroke={dotColor('green')}
        fields={[
          { key: 'uid', value: 'sec_a1f3' },
          { key: 'label', value: 'API token' },
          { key: 'cipher', value: 'aes-gcm…' },
          { key: 'created', value: '1715000…' },
        ]}
      />

      <Card
        xOff={170}
        title="Drift entry"
        accent={errBg}
        accentStroke={errBorder}
        fields={[
          { key: 'uid', value: 'sec_c3d5' },
          { key: 'label', value: 'Old token' },
          { key: 'cipher', value: '', missing: true },
          { key: 'created', value: '"yesterday"', ok: false },
        ]}
        issue="2 schema issues → dropped"
      />

      <text x={160} y={198} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Drift entries are dropped on hydrate and the pill goes yellow.
      </text>
      <text x={160} y={212} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Re-saving from the Vault editor restores the entry's current shape.
      </text>
    </svg>
  );
};

// ─── Live subsystem — per-workflow state + aggregation ────────────

