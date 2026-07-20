import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  TEXT,
  TEXT_DIM,
} from '../_shared';

// ─── What syncs across tabs (shared storage pool) ────────────────

/**
 * "Shared pool" metaphor: chrome.storage at the top holds every
 * persisted entity as a pill. Both tabs sit below and read/write
 * through bidirectional arrows. Visual hook: there's ONE pool, every
 * tab is a window into it. Save in any tab → ripples to all.
 */
export const MultiTabSyncedDiagram: React.FC = () => {
  const t = useT();
  const ID = 'mt-synced';
  // Three rows of pills, sized to fit the storage pool.
  const ROW1 = [
    t('workbench.docs.diagrams.multiTab.synced.pillRules'),
    t('workbench.docs.diagrams.multiTab.synced.pillCollections'),
    t('workbench.docs.diagrams.multiTab.synced.pillFolders'),
  ];
  const ROW2 = [
    t('workbench.docs.diagrams.multiTab.synced.pillEnvironments'),
    t('workbench.docs.diagrams.multiTab.synced.pillVariables'),
    t('workbench.docs.diagrams.multiTab.synced.pillVault'),
  ];
  const ROW3 = [
    t('workbench.docs.diagrams.multiTab.synced.pillRequests'),
    t('workbench.docs.diagrams.multiTab.synced.pillTemplates'),
  ];
  const PILL_H = 18;
  const PILL_GAP = 6;
  const PILL_PAD = 9;
  const charW = 5.5;
  const widthOf = (s: string) => Math.ceil(s.length * charW) + PILL_PAD * 2;

  const rowWidth = (row: string[]) => row.reduce((sum, s) => sum + widthOf(s), 0) + PILL_GAP * (row.length - 1);

  const renderRow = (row: string[], y: number) => {
    const total = rowWidth(row);
    let x = 160 - total / 2;
    return row.map((s) => {
      const w = widthOf(s);
      const node = (
        <g key={`${y}-${s}`}>
          <rect x={x} y={y} width={w} height={PILL_H} rx={9} fill={FILL_GREEN} stroke={STROKE_GREEN} />
          <text x={x + w / 2} y={y + PILL_H / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
            {s}
          </text>
        </g>
      );
      x += w + PILL_GAP;
      return node;
    });
  };

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.multiTab.synced.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE_GREEN}>
        {t('workbench.docs.diagrams.multiTab.synced.title')}
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.synced.subtitle')}
      </text>

      {/* Storage pool */}
      <rect x={20} y={36} width={280} height={108} rx={6} fill="var(--ant-color-success-bg)" stroke={STROKE_GREEN} />
      <text x={32} y={51} fontSize={9} fontWeight={700} fill={STROKE_GREEN}>
        chrome.storage.local
      </text>
      <text x={300} y={51} textAnchor="end" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.synced.sourceOfTruth')}
      </text>

      {renderRow(ROW1, 60)}
      {renderRow(ROW2, 60 + PILL_H + PILL_GAP)}
      {renderRow(ROW3, 60 + (PILL_H + PILL_GAP) * 2)}

      {/* Two tabs below — both pulling from the pool */}
      <rect x={40} y={170} width={100} height={42} rx={4} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} />
      <rect x={40} y={170} width={100} height={14} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={48} y={180} fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.synced.tab1')}
      </text>
      <text x={90} y={201} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.synced.liveData')}
      </text>

      <rect x={180} y={170} width={100} height={42} rx={4} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} />
      <rect x={180} y={170} width={100} height={14} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={188} y={180} fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.synced.tab2')}
      </text>
      <text x={230} y={201} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.synced.liveData')}
      </text>

      {/* Bidirectional arrows from each tab to the pool */}
      <line x1={70} y1={170} x2={70} y2={146} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <line x1={110} y1={146} x2={110} y2={170} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      <line x1={210} y1={170} x2={210} y2={146} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <line x1={250} y1={146} x2={250} y2={170} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      <text x={160} y={228} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.synced.footer')}
      </text>
    </svg>
  );
};

// ─── What stays in each tab (private to that tab) ────────────────

/**
 * Two tab cards side-by-side with visibly DIFFERENT internal states:
 * different sidebar widths and different draft contents. A single
 * dashed wall with one ✗ badge sits between them. The whole point is
 * "look how different these two tabs are right now — and that's
 * fine, because each keeps its own UI state."
 */
export const MultiTabLocalDiagram: React.FC = () => {
  const t = useT();
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  const errBg = 'var(--ant-color-error-bg)';
  const winBorder = 'var(--ant-color-border)';
  const winBg = 'var(--ant-color-bg-container)';
  const sidebarFill = 'var(--ant-color-fill-quaternary)';
  const mainFill = 'var(--ant-color-fill-tertiary)';

  // Layout constants
  const TAB_Y = 44;
  const TAB_W = 132;
  const TAB_H = 158;
  const TITLE_H = 18;

  /** Section label (small text) above a sub-area inside the tab. */
  const SectionLabel = ({ x, y, text }: { x: number; y: number; text: string }) => (
    <text x={x} y={y} fontSize={8} fontWeight={600} fill={TEXT_DIM} letterSpacing={0.4}>
      {text.toUpperCase()}
    </text>
  );

  type Draft = { text: string; unsaved: boolean };
  const renderTab = (xOff: number, ordinal: string, sidebarRatio: number, draft: Draft) => {
    const innerX = xOff + 10;
    const innerW = TAB_W - 20;

    // Layout panel
    const layoutLabelY = TAB_Y + TITLE_H + 12;
    const layoutY = layoutLabelY + 4;
    const layoutH = 60;
    const sidebarW = Math.round(innerW * sidebarRatio);
    // Some fake "rows" inside main panel to imply content.
    const fakeRows = [0.55, 0.7, 0.4, 0.6];

    // Draft area
    const draftLabelY = layoutY + layoutH + 24;
    const draftY = draftLabelY + 4;
    const draftH = 28;

    return (
      <g>
        {/* tab card */}
        <rect x={xOff} y={TAB_Y} width={TAB_W} height={TAB_H} rx={4} fill={winBg} stroke={winBorder} />
        {/* title bar */}
        <rect x={xOff} y={TAB_Y} width={TAB_W} height={TITLE_H} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <circle cx={xOff + 8} cy={TAB_Y + 9} r={2.5} fill={STROKE_BLUE} />
        <text x={xOff + 18} y={TAB_Y + 12} fontSize={10} fontWeight={700} fill={TEXT}>
          {t('workbench.docs.diagrams.multiTab.local.tabTitle', { ordinal })}
        </text>

        {/* LAYOUT */}
        <SectionLabel x={innerX} y={layoutLabelY} text={t('workbench.docs.diagrams.multiTab.local.layoutLabel')} />
        <rect x={innerX} y={layoutY} width={sidebarW} height={layoutH} fill={sidebarFill} stroke={winBorder} />
        <rect
          x={innerX + sidebarW}
          y={layoutY}
          width={innerW - sidebarW}
          height={layoutH}
          fill={mainFill}
          stroke={winBorder}
        />
        {/* sidebar items (3 stripes) */}
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={innerX + 4}
            y={layoutY + 6 + i * 12}
            width={sidebarW - 8}
            height={6}
            rx={1}
            fill="var(--ant-color-fill-secondary)"
          />
        ))}
        {/* main content rows */}
        {fakeRows.map((ratio, i) => {
          const rowX = innerX + sidebarW + 4;
          const rowMaxW = innerW - sidebarW - 8;
          return (
            <rect
              key={i}
              x={rowX}
              y={layoutY + 6 + i * 12}
              width={Math.max(8, rowMaxW * ratio)}
              height={6}
              rx={1}
              fill="var(--ant-color-fill-secondary)"
            />
          );
        })}
        {/* splitter handle — orange tab in the middle */}
        <rect
          x={innerX + sidebarW - 1}
          y={layoutY + layoutH / 2 - 6}
          width={3}
          height={12}
          rx={1.5}
          fill={STROKE_ORANGE}
        />
        {/* small ratio label below the layout */}
        <text x={xOff + TAB_W / 2} y={layoutY + layoutH + 11} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
          {`${Math.round(sidebarRatio * 100)} / ${100 - Math.round(sidebarRatio * 100)}`}
        </text>

        {/* DRAFT */}
        <SectionLabel x={innerX} y={draftLabelY} text={t('workbench.docs.diagrams.multiTab.local.draftLabel')} />
        <rect x={innerX} y={draftY} width={innerW} height={draftH} rx={3} fill={mainFill} stroke={winBorder} />
        {draft.unsaved ? (
          <>
            <text x={innerX + 6} y={draftY + 13} fontFamily="monospace" fontSize={9} fill={TEXT}>
              {draft.text}
            </text>
            <rect
              x={innerX + 6}
              y={draftY + draftH - 12}
              width={48}
              height={9}
              rx={4.5}
              fill={FILL_ORANGE}
              stroke={STROKE_ORANGE}
            />
            <text
              x={innerX + 30}
              y={draftY + draftH - 4}
              textAnchor="middle"
              fontSize={7}
              fontWeight={700}
              fill={STROKE_ORANGE}
            >
              {t('workbench.docs.diagrams.multiTab.local.unsavedBadge')}
            </text>
          </>
        ) : (
          <text
            x={innerX + innerW / 2}
            y={draftY + draftH / 2 + 3}
            textAnchor="middle"
            fontSize={9}
            fontStyle="italic"
            fill={TEXT_DIM}
          >
            {t('workbench.docs.diagrams.multiTab.local.noUnsaved')}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.multiTab.local.aria')}
    >
      {/* Header */}
      <text x={160} y={16} textAnchor="middle" fontSize={11} fontWeight={700} fill={errColor}>
        {t('workbench.docs.diagrams.multiTab.local.title')}
      </text>
      <text x={160} y={32} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.local.subtitle')}
      </text>

      {/* Tab cards */}
      {renderTab(10, '#1', 0.25, { text: 'X-Auth: foo|', unsaved: true })}
      {renderTab(178, '#2', 0.65, { text: '', unsaved: false })}

      {/* Wall between */}
      <line
        x1={160}
        y1={TAB_Y + 4}
        x2={160}
        y2={TAB_Y + TAB_H - 4}
        stroke={errBorder}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <circle cx={160} cy={TAB_Y + TAB_H / 2} r={10} fill={errBg} stroke={errBorder} />
      <line
        x1={156}
        y1={TAB_Y + TAB_H / 2 - 4}
        x2={164}
        y2={TAB_Y + TAB_H / 2 + 4}
        stroke={errColor}
        strokeWidth={1.8}
      />
      <line
        x1={164}
        y1={TAB_Y + TAB_H / 2 - 4}
        x2={156}
        y2={TAB_Y + TAB_H / 2 + 4}
        stroke={errColor}
        strokeWidth={1.8}
      />

      <text x={160} y={216} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.local.footer1')}
      </text>
      <text x={160} y={228} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.local.footer2')}
      </text>
    </svg>
  );
};
