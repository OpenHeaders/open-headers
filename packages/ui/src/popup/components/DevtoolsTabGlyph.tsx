import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';

export const DevtoolsTabGlyph: React.FC = () => {
  const t = useT();
  const BG_CONTAINER = 'var(--ant-color-bg-container)';
  const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
  const FILL_TERTIARY = 'var(--ant-color-fill-tertiary)';
  const BORDER = 'var(--ant-color-border)';
  const GREY = 'var(--ant-color-text-tertiary)';
  const TEXT = 'var(--ant-color-text)';
  const TEXT_DIM = 'var(--ant-color-text-secondary)';
  const PRIMARY = 'var(--ant-color-primary)';

  const FX = 4;
  const FY = 4;
  const FW = 172;
  const FH = 100;
  const titleH = 7;
  const tabsH = 8;
  const browserBodyH = 22;
  const titleY = FY;
  const tabsY = titleY + titleH;
  const browserBodyY = tabsY + tabsH;
  const devY = browserBodyY + browserBodyH;
  const devH = FH - (titleH + tabsH + browserBodyH);
  const devTabH = 11;

  // Devtools tab bar: a couple of placeholder tabs, then Network, two more
  // placeholders, then Lighthouse — followed by our highlighted "Open Headers".
  type DevTab = { kind: 'skeleton'; w: number } | { kind: 'label'; label: string; w: number };
  const devTabs: DevTab[] = [
    { kind: 'skeleton', w: 12 },
    { kind: 'label', label: 'Network', w: 24 },
    { kind: 'skeleton', w: 12 },
    { kind: 'skeleton', w: 12 },
    { kind: 'label', label: 'Lighthouse', w: 30 },
  ];

  return (
    <svg
      viewBox="0 0 180 108"
      width={320}
      height={192}
      role="img"
      aria-label={t('popup.debug.tabGlyphAria')}
      style={{ flexShrink: 0 }}
    >
      <rect x={FX} y={FY} width={FW} height={FH} rx={5} fill={BG_CONTAINER} stroke={BORDER} />

      {/* Browser title bar — traffic lights */}
      <rect x={FX} y={titleY} width={FW} height={titleH} rx={5} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={FX + 5 + i * 5} cy={titleY + titleH / 2} r={1.5} fill={GREY} />
      ))}

      {/* Browser tab strip */}
      <rect x={FX} y={tabsY} width={FW} height={tabsH} fill={FILL_SECONDARY} stroke={BORDER} />
      <rect x={FX + 4} y={tabsY + 2} width={70} height={tabsH - 2} rx={2} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={FX + 8} y={tabsY + tabsH / 2 + 2.5} fontSize={6} fontWeight={700} fill={TEXT}>
        example.com
      </text>
      <text x={FX + FW - 5} y={tabsY + tabsH / 2 + 2.5} textAnchor="end" fontSize={8} fill={GREY}>
        +
      </text>

      {/* Browser body — faded page content rows */}
      <g opacity={0.55}>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={FX + 8}
            y={browserBodyY + 3 + i * 5}
            width={FW - 16 - i * 18}
            height={2}
            rx={1}
            fill={FILL_TERTIARY}
          />
        ))}
      </g>

      {/* DevTools panel (docked at the bottom) */}
      <rect x={FX} y={devY} width={FW} height={devH} fill={BG_CONTAINER} stroke={BORDER} />
      {/* DevTools tab bar */}
      <rect x={FX} y={devY} width={FW} height={devTabH} fill={FILL_SECONDARY} stroke={BORDER} />
      {(() => {
        let cursor = FX + 4;
        const els: React.ReactNode[] = [];
        devTabs.forEach((t, i) => {
          if (t.kind === 'skeleton') {
            els.push(
              <rect
                key={`sk-${i}`}
                x={cursor}
                y={devY + devTabH / 2 - 1.2}
                width={t.w}
                height={2.4}
                rx={1}
                fill={FILL_TERTIARY}
              />,
            );
          } else {
            els.push(
              <text
                key={`lb-${t.label}`}
                x={cursor}
                y={devY + devTabH / 2 + 2.5}
                fontSize={5.5}
                fill={TEXT_DIM}
              >
                {t.label}
              </text>,
            );
          }
          cursor += t.w + 4;
        });
        // "Open Headers" tab — highlighted with primary underline + OH blue square
        const ohX = cursor;
        const ohW = 54;
        els.push(
          <rect
            key="oh-bg"
            x={ohX - 2}
            y={devY + 1}
            width={ohW}
            height={devTabH - 1}
            rx={1}
            fill={BG_CONTAINER}
            stroke={BORDER}
          />,
        );
        els.push(<rect key="oh-square" x={ohX} y={devY + 3} width={5} height={5} fill={PRIMARY} />);
        els.push(
          <text
            key="oh-label"
            x={ohX + 7}
            y={devY + devTabH / 2 + 2.5}
            fontSize={5.5}
            fontWeight={700}
            fill={TEXT}
          >
            Open Headers
          </text>,
        );
        els.push(
          <rect
            key="oh-underline"
            x={ohX - 2}
            y={devY + devTabH - 1.2}
            width={ohW}
            height={1.2}
            fill={PRIMARY}
          />,
        );
        return els;
      })()}

      {/* DevTools body — left sidebar | requests | (multi-pane split with tabs) | right sidebar */}
      {(() => {
        const PRIMARY_BG = 'var(--ant-color-primary-bg)';
        const contentY = devY + devTabH;
        const contentBottom = FY + FH;
        const contentH = contentBottom - contentY;
        const leftSbW = 8;
        const rightSbW = 8;
        const leftSbX = FX;
        const rightSbX = FX + FW - rightSbW;
        const mainX = leftSbX + leftSbW;
        const mainW = FW - leftSbW - rightSbW;
        const splitX = mainX + Math.round(mainW * 0.42);
        const els: React.ReactNode[] = [];

        // Left sidebar (icon strip)
        els.push(
          <rect
            key="lsb"
            x={leftSbX}
            y={contentY}
            width={leftSbW}
            height={contentH}
            fill={FILL_SECONDARY}
            stroke={BORDER}
          />,
        );
        // Active icon (highlighted)
        els.push(
          <rect
            key="lsb-act"
            x={leftSbX + 1}
            y={contentY + 2}
            width={leftSbW - 2}
            height={leftSbW - 2}
            rx={1}
            fill={PRIMARY_BG}
            stroke={PRIMARY}
            strokeWidth={0.5}
          />,
        );
        // Secondary icons (mini squares) — reduced count
        for (let i = 0; i < 2; i++) {
          els.push(
            <rect
              key={`lsb-${i}`}
              x={leftSbX + 2}
              y={contentY + 12 + i * 8}
              width={leftSbW - 4}
              height={3}
              rx={0.6}
              fill={GREY}
              opacity={0.5}
            />,
          );
        }

        // Right sidebar
        els.push(
          <rect
            key="rsb"
            x={rightSbX}
            y={contentY}
            width={rightSbW}
            height={contentH}
            fill={FILL_SECONDARY}
            stroke={BORDER}
          />,
        );
        for (let i = 0; i < 2; i++) {
          els.push(
            <rect
              key={`rsb-${i}`}
              x={rightSbX + 2}
              y={contentY + 3 + i * 6}
              width={rightSbW - 4}
              height={3}
              rx={0.6}
              fill={GREY}
              opacity={0.5}
            />,
          );
        }

        // Toolbar row (in main area)
        const toolbarH = 4.5;
        els.push(
          <rect
            key="tbar"
            x={mainX}
            y={contentY}
            width={mainW}
            height={toolbarH}
            fill={FILL_SECONDARY}
            stroke={BORDER}
          />,
        );
        // Preserve-log pill (subtle)
        els.push(
          <rect
            key="pres"
            x={mainX + 2}
            y={contentY + 1}
            width={20}
            height={toolbarH - 2}
            rx={0.8}
            fill={PRIMARY_BG}
          />,
        );
        // filter input
        els.push(
          <rect
            key="fin"
            x={mainX + 24}
            y={contentY + 1}
            width={splitX - mainX - 28}
            height={toolbarH - 2}
            rx={0.8}
            fill={BG_CONTAINER}
            stroke={BORDER}
          />,
        );

        // Vertical split between requests list and right split-pane area
        const bodyTop = contentY + toolbarH;
        els.push(
          <line
            key="vdiv"
            x1={splitX}
            y1={bodyTop}
            x2={splitX}
            y2={contentBottom}
            stroke={BORDER}
            strokeWidth={0.6}
          />,
        );

        // ── LEFT PANE: requests list ─────────────────────────────
        const SUCCESS = 'var(--ant-color-success)';
        const requests = [
          { id: 1, ts: '13:48:54', name: 'request-1', status: 200 },
          { id: 2, ts: '13:48:55', name: 'request-2', status: 500 },
          { id: 3, ts: '13:48:55', name: 'request-3', status: 200 },
          { id: 4, ts: '13:48:56', name: 'request-4', status: 200 },
        ];

        // Column header strip — with column labels
        const colHeaderH = 4.5;
        els.push(
          <rect
            key="colh"
            x={mainX}
            y={bodyTop}
            width={splitX - mainX}
            height={colHeaderH}
            fill={FILL_TERTIARY}
            opacity={0.55}
          />,
        );
        const colLabels: { x: number; label: string; anchor?: 'start' | 'end' }[] = [
          { x: mainX + 2, label: '#' },
          { x: mainX + 6, label: 'Time' },
          { x: mainX + 22, label: 'Method' },
          { x: mainX + 36, label: 'Name' },
          { x: splitX - 2, label: 'Status', anchor: 'end' },
        ];
        for (const c of colLabels) {
          els.push(
            <text
              key={`colh-${c.label}`}
              x={c.x}
              y={bodyTop + colHeaderH / 2 + 1.2}
              fontSize={2.6}
              fontWeight={700}
              fill={TEXT_DIM}
              textAnchor={c.anchor ?? 'start'}
            >
              {c.label}
            </text>,
          );
        }

        // Request rows — text columns: #id  ts  GET  name  200
        const rowsY = bodyTop + colHeaderH + 0.5;
        const rowH = 5.5;
        for (let i = 0; i < requests.length; i++) {
          const r = requests[i];
          const isSelected = i === 1;
          if (isSelected) {
            els.push(
              <rect
                key={`row-bg-${i}`}
                x={mainX}
                y={rowsY + i * rowH}
                width={splitX - mainX}
                height={rowH}
                fill={PRIMARY_BG}
              />,
            );
          }
          const cy = rowsY + i * rowH + rowH / 2 + 1.1;
          // # id
          els.push(
            <text key={`row-id-${i}`} x={mainX + 2} y={cy} fontSize={3} fill={TEXT}>
              {r.id}
            </text>,
          );
          // ts
          els.push(
            <text key={`row-ts-${i}`} x={mainX + 6} y={cy} fontSize={2.8} fill={TEXT_DIM}>
              {r.ts}
            </text>,
          );
          // GET (green bold)
          els.push(
            <text
              key={`row-mt-${i}`}
              x={mainX + 22}
              y={cy}
              fontSize={3}
              fontWeight={700}
              fill={SUCCESS}
            >
              GET
            </text>,
          );
          // name
          els.push(
            <text key={`row-nm-${i}`} x={mainX + 36} y={cy} fontSize={3} fill={TEXT}>
              {r.name}
            </text>,
          );
          // Status code (red for 4xx/5xx, green otherwise)
          els.push(
            <text
              key={`row-st-${i}`}
              x={splitX - 2}
              y={cy}
              fontSize={3}
              fontWeight={700}
              fill={r.status >= 400 ? 'var(--ant-color-error)' : SUCCESS}
              textAnchor="end"
            >
              {r.status}
            </text>,
          );
        }

        // Skeleton rows below the real requests (suggests more rows can fit)
        const skeletonRowsY = rowsY + requests.length * rowH;
        const skeletonCount = Math.max(0, Math.floor((contentBottom - skeletonRowsY) / rowH));
        for (let i = 0; i < skeletonCount; i++) {
          els.push(
            <rect
              key={`sk-row-${i}`}
              x={mainX + 2}
              y={skeletonRowsY + i * rowH + 2}
              width={(splitX - mainX - 4) * (0.85 - i * 0.1)}
              height={1.4}
              rx={0.5}
              fill={FILL_TERTIARY}
              opacity={0.5}
            />,
          );
        }

        // ── RIGHT AREA: split into 3 panes (top full + bottom-left + bottom-right)
        const rPaneX = splitX + 0.5;
        const rPaneW = rightSbX - rPaneX;
        const hSplitY = bodyTop + Math.round((contentBottom - bodyTop) * 0.5);
        const subSplitX = rPaneX + Math.round(rPaneW * 0.5);

        // Horizontal divider
        els.push(
          <line
            key="hdiv"
            x1={rPaneX}
            y1={hSplitY}
            x2={rightSbX}
            y2={hSplitY}
            stroke={BORDER}
            strokeWidth={0.6}
          />,
        );
        // Vertical divider in bottom half
        els.push(
          <line
            key="vdiv2"
            x1={subSplitX}
            y1={hSplitY}
            x2={subSplitX}
            y2={contentBottom}
            stroke={BORDER}
            strokeWidth={0.6}
          />,
        );

        // Helper to render a sub-pane with proper request tabs ("GET reqN 200" + ×)
        const ERROR = 'var(--ant-color-error)';
        type RequestTab = { name: string; active: boolean; w: number; status?: number };
        const renderSubPane = (
          key: string,
          x: number,
          y: number,
          w: number,
          h: number,
          tabs: RequestTab[],
        ) => {
          const tabBarH = 6.5;
          // Tab bar background
          els.push(
            <rect
              key={`${key}-tabbar`}
              x={x}
              y={y}
              width={w}
              height={tabBarH}
              fill={FILL_SECONDARY}
              stroke={BORDER}
              strokeWidth={0.4}
            />,
          );
          let tx = x + 1;
          tabs.forEach((tab, i) => {
            const tabY = y + 0.4;
            const tabH = tabBarH - 0.4;
            // Tab background (active = container white + subtle borders)
            els.push(
              <rect
                key={`${key}-tab-${i}`}
                x={tx}
                y={tabY}
                width={tab.w}
                height={tabH}
                fill={tab.active ? BG_CONTAINER : 'transparent'}
                stroke={tab.active ? BORDER : 'none'}
                strokeWidth={0.4}
              />,
            );
            const ty = y + tabBarH / 2 + 1.2;
            // GET (green bold)
            els.push(
              <text
                key={`${key}-tab-method-${i}`}
                x={tx + 1.5}
                y={ty}
                fontSize={3}
                fontWeight={700}
                fill={SUCCESS}
              >
                GET
              </text>,
            );
            // request name
            els.push(
              <text
                key={`${key}-tab-name-${i}`}
                x={tx + 8.5}
                y={ty}
                fontSize={3}
                fontWeight={tab.active ? 700 : 400}
                fill={tab.active ? TEXT : TEXT_DIM}
              >
                {tab.name}
              </text>,
            );
            // Status code (green for 2xx, red for 4xx/5xx)
            const status = tab.status ?? 200;
            const statusColor = status >= 400 ? ERROR : SUCCESS;
            els.push(
              <text
                key={`${key}-tab-status-${i}`}
                x={tx + tab.w - (tab.active ? 4 : 1.5)}
                y={ty}
                fontSize={3}
                fontWeight={700}
                fill={statusColor}
                textAnchor="end"
              >
                {status}
              </text>,
            );
            // Close × (active tab only)
            if (tab.active) {
              els.push(
                <text
                  key={`${key}-tab-close-${i}`}
                  x={tx + tab.w - 1.5}
                  y={ty}
                  fontSize={3}
                  fill={TEXT_DIM}
                  textAnchor="end"
                >
                  ×
                </text>,
              );
              // Active-tab bottom underline
              els.push(
                <rect
                  key={`${key}-tab-ul-${i}`}
                  x={tx}
                  y={y + tabBarH - 0.7}
                  width={tab.w}
                  height={0.7}
                  fill={PRIMARY}
                />,
              );
            }
            tx += tab.w + 0.5;
          });

          // Body — request-detail faded content lines
          const bY = y + tabBarH + 1.5;
          const bH = y + h - bY;
          const lineCount = Math.max(1, Math.min(3, Math.floor(bH / 3.5)));
          for (let i = 0; i < lineCount; i++) {
            els.push(
              <rect
                key={`${key}-bl-${i}`}
                x={x + 1.5}
                y={bY + i * 3}
                width={w - 3 - i * 6}
                height={1.4}
                rx={0.5}
                fill={FILL_TERTIARY}
                opacity={0.65}
              />,
            );
          }
        };

        // Top pane (wider, 2 request tabs: request-1 + request-2-active with 500 status)
        renderSubPane('top', rPaneX, bodyTop, rPaneW, hSplitY - bodyTop, [
          { name: 'request-1', active: false, w: 38 },
          { name: 'request-2', active: true, w: 40, status: 500 },
        ]);
        // Bottom-left pane — request-3 tab (not focused)
        renderSubPane('bl', rPaneX, hSplitY + 0.5, subSplitX - rPaneX, contentBottom - hSplitY - 0.5, [
          { name: 'request-3', active: false, w: 40 },
        ]);
        // Bottom-right pane — request-4 tab (not focused)
        renderSubPane('br', subSplitX + 0.5, hSplitY + 0.5, rightSbX - subSplitX - 0.5, contentBottom - hSplitY - 0.5, [
          { name: 'request-4', active: false, w: 40 },
        ]);

        return els;
      })()}
    </svg>
  );
};
