import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, FILL_GREEN, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from '../_shared';

// ─── Tab numbering: ordinals are stable within a tab's lifetime ───

/**
 * Five Chrome-style tab-strip mockups stacked vertically, each
 * showing the same window after one user action. The point is
 * concrete, not abstract: open three tabs, close the first, open
 * one more — the new one is #4, not #1, because survivors never
 * renumber. Highlight ribbons on the right call out the moment
 * each rule kicks in (prefix appears, prefix sheds, ordinal stays).
 */
export const MultiTabNumberingDiagram: React.FC = () => {
  const t = useT();
  type Tab = { title: string; closed?: boolean; isNew?: boolean; w?: number };
  type Step = { action: string; tabs: Tab[]; note?: string };
  const STEPS: Step[] = [
    {
      action: t('workbench.docs.diagrams.multiTab.numbering.step1'),
      tabs: [{ title: 'Open Headers', isNew: true, w: 96 }],
      note: t('workbench.docs.diagrams.multiTab.numbering.note1'),
    },
    {
      action: t('workbench.docs.diagrams.multiTab.numbering.step2'),
      tabs: [{ title: '#1' }, { title: '#2', isNew: true }],
      note: t('workbench.docs.diagrams.multiTab.numbering.note2'),
    },
    {
      action: t('workbench.docs.diagrams.multiTab.numbering.step3'),
      tabs: [{ title: '#1' }, { title: '#2' }, { title: '#3', isNew: true }],
    },
    {
      action: t('workbench.docs.diagrams.multiTab.numbering.step4'),
      tabs: [{ title: '#1', closed: true }, { title: '#2' }, { title: '#3' }],
      note: t('workbench.docs.diagrams.multiTab.numbering.note4'),
    },
    {
      action: t('workbench.docs.diagrams.multiTab.numbering.step5'),
      tabs: [{ title: '#2' }, { title: '#3' }, { title: '#4', isNew: true }],
      note: t('workbench.docs.diagrams.multiTab.numbering.note5'),
    },
  ];

  const ROW_Y = 30;
  const ROW_H = 22;
  const ROW_GAP = 8;
  const STRIP_X = 78;
  const STRIP_W = 160;
  const TAB_W = 48;
  const TAB_GAP = 4;

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.multiTab.numbering.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.numbering.title')}
      </text>

      {STEPS.map((step, si) => {
        const y = ROW_Y + si * (ROW_H + ROW_GAP);
        return (
          <g key={step.action}>
            {/* Action label (left) */}
            <text x={70} y={y + 14} textAnchor="end" fontSize={9} fontWeight={600} fill={TEXT}>
              {step.action}
            </text>

            {/* Tab strip background */}
            <rect
              x={STRIP_X}
              y={y}
              width={STRIP_W}
              height={ROW_H}
              fill="var(--ant-color-fill-secondary)"
              stroke="var(--ant-color-border)"
            />

            {/* Tabs */}
            {(() => {
              let cursor = STRIP_X + 4;
              return step.tabs.map((tab, ti) => {
                const tw = tab.w ?? TAB_W;
                const tx = cursor;
                cursor += tw + TAB_GAP;
                if (tab.closed) {
                  return (
                    <g key={`${step.action}-${ti}`}>
                      <rect
                        x={tx}
                        y={y + 2}
                        width={tw}
                        height={ROW_H - 4}
                        rx={3}
                        fill="transparent"
                        stroke="var(--ant-color-border-secondary)"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1={tx + 6}
                        y1={y + 6}
                        x2={tx + tw - 6}
                        y2={y + ROW_H - 6}
                        stroke="var(--ant-color-error)"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={tx + tw - 6}
                        y1={y + 6}
                        x2={tx + 6}
                        y2={y + ROW_H - 6}
                        stroke="var(--ant-color-error)"
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                }
                return (
                  <g key={`${step.action}-${ti}`}>
                    <rect
                      x={tx}
                      y={y + 2}
                      width={tw}
                      height={ROW_H - 4}
                      rx={3}
                      fill={tab.isNew ? FILL_GREEN : FILL_BLUE}
                      stroke={tab.isNew ? STROKE_GREEN : STROKE_BLUE}
                    />
                    <text
                      x={tx + tw / 2}
                      y={y + ROW_H / 2 + 3}
                      textAnchor="middle"
                      fontFamily="monospace"
                      fontSize={9}
                      fontWeight={600}
                      fill={TEXT}
                    >
                      {tab.title}
                    </text>
                  </g>
                );
              });
            })()}

            {/* Right-side note */}
            {step.note && (
              <text x={244} y={y + 14} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
                {step.note}
              </text>
            )}
          </g>
        );
      })}

      <text x={160} y={195} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.numbering.footer')}
      </text>
    </svg>
  );
};
