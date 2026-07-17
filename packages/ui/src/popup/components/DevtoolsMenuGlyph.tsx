import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';

export const DevtoolsMenuGlyph: React.FC = () => {
  const t = useT();
  const BG_CONTAINER = 'var(--ant-color-bg-container)';
  const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
  const FILL_TERTIARY = 'var(--ant-color-fill-tertiary)';
  const BORDER = 'var(--ant-color-border)';
  const GREY = 'var(--ant-color-text-tertiary)';
  const TEXT = 'var(--ant-color-text)';
  const TEXT_DIM = 'var(--ant-color-text-secondary)';
  const PRIMARY = 'var(--ant-color-primary)';

  // Browser frame layout — plain page frame (title bar, tab strip, faded body rows),
  // shifted down to leave room for the system menu bar overlaid above it
  const FX = 4;
  const menuBarH = 8;
  const FY = 4 + menuBarH;
  const FW = 172;
  const FH = 62;
  const titleH = 10;
  const tabsH = 12;
  const titleY = FY;
  const tabsY = titleY + titleH;
  const bodyY = tabsY + tabsH;

  // Menu bar items — full names, positioned with width-aware spacing
  const menuItems = [
    { label: 'Edit', w: 14 },
    { label: 'View', w: 15, highlighted: true },
    { label: 'History', w: 23 },
    { label: 'Bookmarks', w: 30 },
    { label: 'Tab', w: 12 },
  ];
  let cursor = 4;
  const positionedMenu = menuItems.map((m) => {
    const x = cursor;
    cursor += m.w + 5;
    return { ...m, x };
  });
  const viewItem = positionedMenu.find((m) => m.highlighted);

  // Sub-dropdown layout
  const subX = 70;
  const subW = 74;

  return (
    <svg
      viewBox="0 0 180 78"
      width={260}
      height={113}
      role="img"
      aria-label={t('popup.debug.menuGlyphAria')}
      style={{ flexShrink: 0 }}
    >
      {/* System menu bar (above the browser window) */}
      <rect x={0} y={0} width={180} height={menuBarH} fill={FILL_TERTIARY} />
      {positionedMenu.map((m) =>
        m.highlighted ? (
          <g key={m.label}>
            <rect x={m.x - 1} y={1} width={m.w + 2} height={menuBarH - 2} rx={1} fill={PRIMARY} />
            <text
              x={m.x + m.w / 2}
              y={6.5}
              textAnchor="middle"
              fontSize={5.5}
              fontWeight={700}
              fill="#fff"
            >
              {m.label}
            </text>
          </g>
        ) : (
          <text key={m.label} x={m.x} y={6.5} fontSize={5.5} fill={TEXT_DIM}>
            {m.label}
          </text>
        ),
      )}

      {/* Browser frame */}
      <rect x={FX} y={FY} width={FW} height={FH} rx={5} fill={BG_CONTAINER} stroke={BORDER} />
      {/* Title bar — traffic lights */}
      <rect x={FX} y={titleY} width={FW} height={titleH} rx={5} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={FX + 7 + i * 6} cy={titleY + titleH / 2} r={2} fill={GREY} />
      ))}
      {/* Tab strip */}
      <rect x={FX} y={tabsY} width={FW} height={tabsH} fill={FILL_SECONDARY} stroke={BORDER} />
      <rect x={FX + 5} y={tabsY + 2} width={90} height={tabsH - 2} rx={3} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={FX + 10} y={tabsY + tabsH / 2 + 3} fontSize={7} fontWeight={700} fill={TEXT}>
        example.com
      </text>
      <text x={FX + FW - 6} y={tabsY + tabsH / 2 + 3} textAnchor="end" fontSize={9} fill={GREY}>
        +
      </text>
      {/* Body — faded placeholder rows (dimmed by the menu overlay above) */}
      <g opacity={0.4}>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={FX + 8}
            y={bodyY + 6 + i * 7}
            width={FW - 16 - i * 14}
            height={3}
            rx={1.5}
            fill={FILL_TERTIARY}
          />
        ))}
      </g>

      {/* Primary dropdown — hangs from "View" in the menu bar */}
      <rect x={viewItem ? viewItem.x - 2 : 12} y={menuBarH} width={48} height={50} rx={2} fill={BG_CONTAINER} stroke={BORDER} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`row-${i}`}
          x={(viewItem ? viewItem.x - 2 : 12) + 4}
          y={menuBarH + 4 + i * 7}
          width={36 - i * 4}
          height={2}
          rx={1}
          fill={FILL_TERTIARY}
        />
      ))}
      {/* "Developer ▸" highlighted row */}
      <rect x={viewItem ? viewItem.x - 2 : 12} y={menuBarH + 38} width={48} height={10} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={(viewItem ? viewItem.x - 2 : 12) + 4} y={menuBarH + 45} fontSize={6} fontWeight={700} fill={TEXT}>
        {t('popup.debug.menuGlyphDeveloper')}
      </text>
      <text x={(viewItem ? viewItem.x - 2 : 12) + 44} y={menuBarH + 45} textAnchor="end" fontSize={7} fill={TEXT_DIM}>
        ▸
      </text>

      {/* Sub-dropdown — cascades to the right of "Developer" */}
      <rect x={subX} y={menuBarH + 34} width={subW} height={30} rx={2} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={subX} y={menuBarH + 37} width={subW} height={9} fill={PRIMARY} />
      <text x={subX + 4} y={menuBarH + 43.5} fontSize={6} fontWeight={700} fill="#fff">
        {t('popup.debug.menuGlyphDeveloperTools')}
      </text>
      {[0, 1].map((i) => (
        <rect
          key={`sub-${i}`}
          x={subX + 4}
          y={menuBarH + 49 + i * 5}
          width={42 - i * 8}
          height={1.8}
          rx={0.8}
          fill={FILL_TERTIARY}
        />
      ))}
    </svg>
  );
};
