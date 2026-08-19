import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs,FILL_BLUE,STROKE,STROKE_BLUE,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS_BG,WARNING_BG,ERROR_BG,BORDER,FILL_SECONDARY,BG_CONTAINER,Level,dotColor } from './_shared';

/**
 * Impact: the WHY behind this audit. Two side-by-side scenarios of
 * the same rule against the same site. Left: <all_urls> granted →
 * rule fires. Right: host revoked → rule silently no-ops, no error
 * surfaced anywhere except this pill. That silent failure is exactly
 * what users would otherwise spend half an hour debugging.
 */
export const PermissionsImpactDiagram: React.FC = () => {
  const t = useT();
  const errBorder = 'var(--ant-color-error-border)';
  const errColor = dotColor('red');

  /** A miniature "rule applied / not applied" tile for one side. */
  const Tile = ({ xOff, granted }: { xOff: number; granted: boolean }) => {
    const accent = granted ? dotColor('green') : errColor;
    const tileBg = granted ? SUCCESS_BG : ERROR_BG;
    return (
      <g>
        {/* Heading band */}
        <rect x={xOff} y={30} width={140} height={22} rx={4} fill={tileBg} stroke={accent} />
        <circle cx={xOff + 12} cy={41} r={3.5} fill={accent} />
        <text x={xOff + 24} y={44} fontSize={10} fontWeight={700} fill={TEXT}>
          {granted
            ? t('workbench.docs.diagrams.systemStatus.permissionsImpact.granted')
            : t('workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed')}
        </text>
        <text x={xOff + 134} y={44} textAnchor="end" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
          {granted ? '<all_urls>' : t('workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked')}
        </text>

        {/* Same rule shown in both tiles for comparison */}
        <rect x={xOff + 6} y={62} width={128} height={28} rx={3} fill={BG_CONTAINER} stroke={BORDER} />
        <text x={xOff + 12} y={75} fontSize={9} fontWeight={700} fill={TEXT}>
          {t('workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader')}
        </text>
        <text x={xOff + 12} y={86} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
          api.openheaders.com
        </text>

        {/* Request flow */}
        <rect x={xOff + 6} y={102} width={56} height={26} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <text x={xOff + 34} y={113} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
          {t('workbench.docs.diagrams.systemStatus.permissionsImpact.page')}
        </text>
        <text x={xOff + 34} y={123} textAnchor="middle" fontFamily="monospace" fontSize={7} fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall')}
        </text>

        {/* Arrow */}
        <line
          x1={xOff + 62}
          y1={115}
          x2={xOff + 76}
          y2={115}
          stroke={accent}
          strokeWidth={1.5}
          strokeDasharray={granted ? undefined : '2 2'}
          markerEnd={granted ? 'url(#perm-arrow-ok)' : 'url(#perm-arrow-x)'}
        />

        <rect
          x={xOff + 78}
          y={102}
          width={56}
          height={26}
          rx={3}
          fill={tileBg}
          stroke={accent}
          strokeDasharray={granted ? undefined : '3 2'}
        />
        <text x={xOff + 106} y={113} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
          DNR
        </text>
        <text x={xOff + 106} y={123} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
          {granted
            ? t('workbench.docs.diagrams.systemStatus.permissionsImpact.applies')
            : t('workbench.docs.diagrams.systemStatus.permissionsImpact.noOp')}
        </text>

        {/* Outcome row */}
        <rect x={xOff + 6} y={138} width={128} height={26} rx={3} fill={tileBg} stroke={accent} />
        <text x={xOff + 70} y={150} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
          {granted
            ? t('workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives')
            : t('workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing')}
        </text>
        <text x={xOff + 70} y={161} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
          {granted
            ? t('workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired')
            : t('workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp')}
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
      aria-label={t('workbench.docs.diagrams.systemStatus.permissionsImpact.aria')}
    >
      {/* Local arrow markers — green and red variants */}
      <defs>
        <marker id="perm-arrow-ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={dotColor('green')} />
        </marker>
        <marker id="perm-arrow-x" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={errBorder} />
        </marker>
      </defs>

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.permissionsImpact.title')}
      </text>

      <Tile xOff={10} granted />
      <Tile xOff={170} granted={false} />

      <text x={160} y={186} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.permissionsImpact.footer1')}
      </text>
      <text x={160} y={202} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.permissionsImpact.footer2')}
      </text>
    </svg>
  );
};

/**
 * Audit flow: when this check runs, and what each branch reports.
 * MV3 has no permission-change observer in Chromium, so the audit
 * polls on every SW wake.
 */
export const PermissionsAuditFlowDiagram: React.FC = () => {
  const t = useT();
  const ID = 'perm-audit';

  type Branch = { label: string; sub: string; level: Exclude<Level, 'grey'>; msg: string };
  const BRANCHES: Branch[] = [
    {
      label: 'granted = true',
      sub: t('workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath'),
      level: 'green',
      msg: t('workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted'),
    },
    {
      label: 'granted = false',
      sub: t('workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked'),
      level: 'red',
      msg: t('workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed'),
    },
    {
      label: t('workbench.docs.diagrams.systemStatus.permissionsAudit.throws'),
      sub: t('workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable'),
      level: 'yellow',
      msg: t('workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed'),
    },
  ];

  // Box geometry: 3 boxes with gaps. Total = 3·BOX_W + 2·BOX_GAP ≤ 300.
  const BOX_W = 94;
  const BOX_GAP = 8;
  const TOTAL_W = BOX_W * 3 + BOX_GAP * 2;
  const BOX_X0 = (320 - TOTAL_W) / 2;
  const boxX = (i: number) => BOX_X0 + i * (BOX_W + BOX_GAP);
  const boxCenter = (i: number) => boxX(i) + BOX_W / 2;

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.permissionsAudit.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.permissionsAudit.title')}
      </text>

      {/* SW wake trigger */}
      <rect x={104} y={30} width={112} height={28} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={160} y={42} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.shared.swWakes')}
      </text>
      <text x={160} y={52} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration')}
      </text>

      {/* Arrow down */}
      <line x1={160} y1={58} x2={160} y2={74} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* permissions.contains call */}
      <rect x={64} y={76} width={192} height={28} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={160} y={88} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        chrome.permissions.contains
      </text>
      <text x={160} y={99} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins')}
      </text>

      {/* Three branch arrows */}
      {BRANCHES.map((b, i) => (
        <line
          key={b.label}
          x1={160}
          y1={104}
          x2={boxCenter(i)}
          y2={124}
          stroke={dotColor(b.level)}
          strokeWidth={1.5}
          markerEnd={`url(#${ID})`}
        />
      ))}

      {/* Branch outcome boxes */}
      {BRANCHES.map((branch, i) => {
        const x = boxX(i);
        const cx = boxCenter(i);
        const fill = branch.level === 'red' ? ERROR_BG : branch.level === 'yellow' ? WARNING_BG : SUCCESS_BG;
        const stroke = dotColor(branch.level);
        return (
          <g key={branch.label}>
            <rect x={x} y={126} width={BOX_W} height={86} rx={4} fill={fill} stroke={stroke} />
            <text x={cx} y={140} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
              {branch.label}
            </text>
            <text x={cx} y={152} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {branch.sub}
            </text>
            {/* Resulting pill */}
            <rect x={x + 8} y={160} width={BOX_W - 16} height={16} rx={3} fill={BG_CONTAINER} stroke={stroke} />
            <circle cx={x + 16} cy={168} r={2.5} fill={stroke} />
            <text x={cx + 4} y={171} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
              {branch.level === 'green'
                ? t('workbench.docs.diagrams.systemStatus.shared.green')
                : branch.level === 'yellow'
                  ? t('workbench.docs.diagrams.systemStatus.shared.yellow')
                  : t('workbench.docs.diagrams.systemStatus.shared.red')}
            </text>
            <text x={cx} y={196} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
              {branch.msg}
            </text>
          </g>
        );
      })}

      <text x={160} y={224} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.permissionsAudit.footer1')}
      </text>
      <text x={160} y={236} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.permissionsAudit.footer2')}
      </text>
    </svg>
  );
};

// ─── Secrets subsystem — vault hydrate + drift ────────────────────

