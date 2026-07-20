import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs,STROKE,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS,WARNING,ERROR,SUCCESS_BG,WARNING_BG,ERROR_BG,GREY,BORDER,FILL_SECONDARY,BG_CONTAINER,Level,dotColor } from './_shared';

/**
 * Topology: the extension's background SW maintains a single
 * WebSocket to the desktop app on `127.0.0.1:8137`. The line in the
 * middle carries the actual data shapes — keeping it labeled keeps
 * "what does syncing actually do?" answerable without reading prose.
 */
export const SyncTopologyDiagram: React.FC = () => {
  const t = useT();
  const ID = 'sync-topo';
  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.syncTopology.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.title')}
      </text>

      {/* Extension card (left) */}
      <rect x={14} y={36} width={120} height={108} rx={6} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={14} y={36} width={120} height={20} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={74} y={50} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.extension')}
      </text>
      <text x={74} y={72} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker')}
      </text>
      {/* Mini browser icon */}
      <rect x={50} y={82} width={48} height={36} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={56 + i * 6} cy={89} r={2} fill={GREY} />
      ))}
      <rect x={54} y={96} width={40} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={54} y={102} width={28} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={54} y={108} width={34} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <text x={74} y={134} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.wsClient')}
      </text>

      {/* Desktop card (right) */}
      <rect x={186} y={36} width={120} height={108} rx={6} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={186} y={36} width={120} height={20} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={246} y={50} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.shared.desktopApp')}
      </text>
      <text x={246} y={72} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine')}
      </text>
      {/* Mini desktop window icon */}
      <rect x={210} y={82} width={72} height={36} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />
      <rect x={210} y={82} width={72} height={6} fill="var(--ant-color-fill-tertiary)" stroke={BORDER} />
      <circle cx={215} cy={85} r={1.5} fill={ERROR} />
      <circle cx={220} cy={85} r={1.5} fill={WARNING} />
      <circle cx={225} cy={85} r={1.5} fill={SUCCESS} />
      <rect x={215} y={94} width={62} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={215} y={100} width={50} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={215} y={106} width={56} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <text x={246} y={134} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.wsServer')}
      </text>

      {/* WebSocket line between */}
      <line x1={134} y1={90} x2={186} y2={90} stroke={SUCCESS} strokeWidth={2} />
      <line x1={134} y1={110} x2={186} y2={110} stroke={SUCCESS} strokeWidth={2} markerEnd={`url(#${ID})`} />
      <line x1={186} y1={110} x2={134} y2={110} stroke={SUCCESS} strokeWidth={2} markerEnd={`url(#${ID})`} />
      <text x={160} y={86} textAnchor="middle" fontSize={8} fontWeight={700} fill={SUCCESS}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.webSocket')}
      </text>
      <text x={160} y={124} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        127.0.0.1:8137
      </text>

      <text x={160} y={166} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.carries')}
      </text>
      <text x={160} y={184} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncTopology.loopback')}
      </text>
    </svg>
  );
};

/**
 * Lifecycle: a UML-style sequence diagram of the Sync connection
 * lifetime. Three lifelines — Extension SW, Desktop app, and the
 * Status pill — and a sequence of messages timed top-to-bottom. The
 * Status pill column shows the colored state at each transition so
 * "what does the user see when X happens?" is answerable at a glance.
 */
export const SyncLifecycleDiagram: React.FC = () => {
  const t = useT();
  const ID = 'sync-life';

  // Lifeline anchor X positions
  const X_SW = 44;
  const X_DESK = 156;
  const X_PILL = 276;
  const PILL_W = 64;

  // Status pill column helper — renders a tiny pill at a given Y to
  // mirror what the actual UI shows at that point in the timeline.
  const StatusMarker = ({ y, level, label }: { y: number; level: Exclude<Level, 'grey'>; label: string }) => {
    const fill = level === 'green' ? SUCCESS_BG : level === 'yellow' ? WARNING_BG : ERROR_BG;
    const stroke = dotColor(level);
    return (
      <g>
        <rect x={X_PILL - PILL_W / 2} y={y - 7} width={PILL_W} height={14} rx={4} fill={fill} stroke={stroke} />
        <circle cx={X_PILL - PILL_W / 2 + 5} cy={y} r={2.5} fill={dotColor(level)} />
        <text x={X_PILL - PILL_W / 2 + 11} y={y + 3} fontSize={8} fontWeight={700} fill={TEXT}>
          {label}
        </text>
      </g>
    );
  };

  const ARROW_LABEL_FS = 8;

  return (
    <svg
      viewBox="0 0 320 340"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.syncLifecycle.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.title')}
      </text>

      {/* Lifeline headers */}
      <rect x={X_SW - 40} y={24} width={80} height={22} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={X_SW} y={38} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw')}
      </text>

      <rect x={X_DESK - 40} y={24} width={80} height={22} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={X_DESK} y={38} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.shared.desktopApp')}
      </text>

      <rect
        x={X_PILL - PILL_W / 2 - 4}
        y={24}
        width={PILL_W + 8}
        height={22}
        rx={4}
        fill={FILL_SECONDARY}
        stroke={BORDER}
      />
      <text x={X_PILL} y={38} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill')}
      </text>

      {/* Lifelines */}
      {[X_SW, X_DESK, X_PILL].map((x) => (
        <line key={x} x1={x} y1={46} x2={x} y2={310} stroke={STROKE} strokeDasharray="2 3" />
      ))}

      {/* ── Event 1: SW boot reads settings ── */}
      <text x={X_SW} y={62} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.shared.swWakes')}
      </text>
      <text x={X_SW} y={74} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings')}
      </text>

      {/* ── Event 2: auto-connect off branch — status disabled (green) ── */}
      <text x={(X_SW + X_PILL) / 2} y={90} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff')}
      </text>
      <StatusMarker
        y={94}
        level="green"
        label={t('workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled')}
      />

      {/* divider */}
      <line x1={20} y1={108} x2={300} y2={108} stroke={BORDER} strokeDasharray="3 3" />
      <text x={160} y={105} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise')}
      </text>

      {/* ── Event 3: SW initiates WS connection ── */}
      <line x1={X_SW} y1={122} x2={X_DESK - 2} y2={122} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={(X_SW + X_DESK) / 2} y={118} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect')}
      </text>
      <StatusMarker
        y={126}
        level="yellow"
        label={t('workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting')}
      />

      {/* ── Event 4: handshake OK ── */}
      <line x1={X_DESK} y1={146} x2={X_SW + 2} y2={146} stroke={SUCCESS} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={(X_SW + X_DESK) / 2} y={142} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={SUCCESS}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk')}
      </text>
      <StatusMarker
        y={150}
        level="green"
        label={t('workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected')}
      />

      {/* Activation bars on both lifelines while connected */}
      <rect x={X_SW - 3} y={150} width={6} height={50} fill={SUCCESS_BG} stroke={dotColor('green')} />
      <rect x={X_DESK - 3} y={150} width={6} height={50} fill={SUCCESS_BG} stroke={dotColor('green')} />

      {/* ── Event 5: keep-alive ping ── */}
      <line
        x1={X_SW + 3}
        y1={172}
        x2={X_DESK - 3}
        y2={172}
        stroke={STROKE}
        strokeWidth={1}
        strokeDasharray="2 2"
        markerEnd={`url(#${ID})`}
      />
      <line
        x1={X_DESK - 3}
        y1={184}
        x2={X_SW + 3}
        y2={184}
        stroke={STROKE}
        strokeWidth={1}
        strokeDasharray="2 2"
        markerEnd={`url(#${ID})`}
      />
      <text x={(X_SW + X_DESK) / 2} y={168} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong')}
      </text>

      {/* ── Event 6: drop ── */}
      <text
        x={(X_SW + X_DESK) / 2}
        y={216}
        textAnchor="middle"
        fontSize={ARROW_LABEL_FS}
        fontWeight={700}
        fill={WARNING}
      >
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops')}
      </text>
      <line x1={X_SW + 8} y1={220} x2={X_DESK - 8} y2={220} stroke={WARNING} strokeWidth={1} strokeDasharray="3 3" />
      <line
        x1={(X_SW + X_DESK) / 2 - 5}
        y1={215}
        x2={(X_SW + X_DESK) / 2 + 5}
        y2={225}
        stroke={WARNING}
        strokeWidth={1.5}
      />
      <line
        x1={(X_SW + X_DESK) / 2 + 5}
        y1={215}
        x2={(X_SW + X_DESK) / 2 - 5}
        y2={225}
        stroke={WARNING}
        strokeWidth={1.5}
      />
      <StatusMarker y={224} level="yellow" label={t('workbench.docs.diagrams.systemStatus.syncLifecycle.retry1')} />

      {/* ── Event 7: backoff + retry ── */}
      <text x={X_SW} y={246} textAnchor="middle" fontSize={ARROW_LABEL_FS} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.backoff')}
      </text>
      <line x1={X_SW} y1={252} x2={X_DESK - 2} y2={252} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={(X_SW + X_DESK) / 2} y={248} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect')}
      </text>
      <StatusMarker y={256} level="yellow" label={t('workbench.docs.diagrams.systemStatus.syncLifecycle.retry2')} />

      {/* ── Event 8: handshake OK again ── */}
      <line x1={X_DESK} y1={278} x2={X_SW + 2} y2={278} stroke={SUCCESS} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={(X_SW + X_DESK) / 2} y={274} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={SUCCESS}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk')}
      </text>
      <StatusMarker
        y={282}
        level="green"
        label={t('workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected')}
      />

      <text x={160} y={326} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.syncLifecycle.footer')}
      </text>
    </svg>
  );
};

// ─── Rules subsystem — compile pipeline + capacity ────────────────

