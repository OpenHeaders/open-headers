/**
 * PostmanKeySteps — compact three-step walkthrough for minting a
 * Postman API key, rendered under the key input of the account-pull
 * stepper: open the account settings menu in Postman (app or web) →
 * generate a key on the API keys page → copy the one-time value. Same
 * visual language as the
 * response pane's CertTrustSteps: minimalist theme-token SVG glyphs
 * with one-line captions, arrow-joined cards.
 */

import { ArrowRightOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import type React from 'react';
import { Fragment } from 'react';

const { Text } = Typography;

const GLYPH_W = 132;
const GLYPH_H = 68;

const BG_CONTAINER = 'var(--ant-color-bg-container)';
const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
const FILL_TERTIARY = 'var(--ant-color-fill-tertiary)';
const BORDER = 'var(--ant-color-border)';
const GREY = 'var(--ant-color-text-tertiary)';
const TEXT = 'var(--ant-color-text)';
const TEXT_DIM = 'var(--ant-color-text-secondary)';
const PRIMARY = 'var(--ant-color-primary)';
const WARNING = 'var(--ant-color-warning)';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/** Shared mini browser chrome — title bar with traffic lights. */
const FrameChrome: React.FC = () => (
  <g>
    <rect x={1} y={1} width={118} height={8} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
    {[0, 1, 2].map((i) => (
      <circle key={i} cx={7 + i * 6} cy={5} r={1.8} fill={GREY} />
    ))}
  </g>
);

/** Step 1 — postman.co with the top-right account menu open on Account settings. */
const AccountMenuGlyph: React.FC = () => (
  <svg viewBox="0 0 120 62" width={GLYPH_W} height={GLYPH_H} aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x={1} y={1} width={118} height={60} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
    <FrameChrome />
    {/* Address bar with the postman.co URL */}
    <rect x={6} y={12} width={108} height={9} rx={4.5} fill={FILL_TERTIARY} />
    <text x={13} y={18.4} fontSize={5.5} fill={TEXT_DIM} fontFamily={MONO}>
      postman.co
    </text>
    {/* Top-right gear — the menu's anchor */}
    <circle cx={106} cy={28} r={4} fill="none" stroke={PRIMARY} strokeWidth={1.4} />
    <circle cx={106} cy={28} r={1.4} fill={PRIMARY} />
    {/* Dropdown — dim rows above the lit "Account settings" row */}
    <rect x={56} y={34} width={58} height={24} rx={3} fill={BG_CONTAINER} stroke={BORDER} />
    <rect x={60} y={38} width={34} height={2.8} rx={1.4} fill={FILL_SECONDARY} />
    <rect x={60} y={44} width={40} height={2.8} rx={1.4} fill={FILL_SECONDARY} />
    <rect x={58} y={49} width={54} height={7} rx={2} fill={FILL_TERTIARY} stroke={PRIMARY} strokeWidth={0.8} />
    <text x={61} y={54} fontSize={5} fontWeight={700} fill={TEXT}>
      Account settings
    </text>
    {/* Faded page body behind the menu */}
    <g opacity={0.4}>
      {[0, 1].map((i) => (
        <rect key={i} x={8} y={30 + i * 7} width={40 - i * 12} height={3} rx={1.5} fill={FILL_TERTIARY} />
      ))}
    </g>
  </svg>
);

/** Step 2 — the API keys settings page with Generate API key lit. */
const GenerateKeyGlyph: React.FC = () => (
  <svg viewBox="0 0 120 62" width={GLYPH_W} height={GLYPH_H} aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x={1} y={1} width={118} height={60} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
    <FrameChrome />
    {/* Left sidebar — dim rows, "API keys" lit at the bottom */}
    <rect x={1} y={9} width={34} height={52} fill={FILL_SECONDARY} opacity={0.6} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={6} y={15 + i * 8} width={22 - i * 4} height={3} rx={1.5} fill={FILL_TERTIARY} />
    ))}
    <rect x={4} y={39} width={28} height={9} rx={2} fill={BG_CONTAINER} stroke={PRIMARY} strokeWidth={0.8} />
    <text x={7} y={45.4} fontSize={5} fontWeight={700} fill={TEXT}>
      API keys
    </text>
    {/* Page heading + Generate API key button */}
    <rect x={42} y={15} width={30} height={3.4} rx={1.7} fill={FILL_SECONDARY} />
    <rect x={42} y={22} width={48} height={2.6} rx={1.3} fill={FILL_TERTIARY} />
    <rect x={72} y={30} width={42} height={11} rx={2.5} fill={PRIMARY} />
    <text x={93} y={37.6} textAnchor="middle" fontSize={5} fontWeight={700} fill="#fff">
      Generate API key
    </text>
    {/* Existing key rows, faded */}
    <g opacity={0.4}>
      {[0, 1].map((i) => (
        <rect key={i} x={42} y={47 + i * 6} width={72 - i * 18} height={3} rx={1.5} fill={FILL_TERTIARY} />
      ))}
    </g>
  </svg>
);

/** Step 3 — the one-time "Copy your API key" dialog with the PMAK value. */
const CopyKeyGlyph: React.FC = () => (
  <svg viewBox="0 0 120 62" width={GLYPH_W} height={GLYPH_H} aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x={1} y={1} width={118} height={60} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
    <FrameChrome />
    {/* Centered dialog */}
    <rect x={14} y={13} width={92} height={44} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
    <rect x={20} y={18} width={44} height={3.4} rx={1.7} fill={FILL_SECONDARY} />
    {/* One-time warning stripe */}
    <rect x={20} y={25} width={80} height={8} rx={2} fill={WARNING} opacity={0.18} />
    <path d="M 24 31 L 26.5 26.5 L 29 31 Z" fill={WARNING} />
    <rect x={32} y={28} width={56} height={2.4} rx={1.2} fill={FILL_SECONDARY} />
    {/* Key field with the PMAK value + copy icon */}
    <rect x={20} y={37} width={80} height={9} rx={2} fill={FILL_TERTIARY} />
    <text x={24} y={43.4} fontSize={5.5} fontWeight={700} fill={TEXT} fontFamily={MONO}>
      PMAK-6a59e…
    </text>
    <rect x={88} y={39} width={5} height={5} rx={1} fill="none" stroke={TEXT_DIM} strokeWidth={0.9} />
    <rect x={90} y={41} width={5} height={5} rx={1} fill={FILL_TERTIARY} stroke={TEXT_DIM} strokeWidth={0.9} />
    {/* Copy to Clipboard — the step's action */}
    <rect x={54} y={49} width={46} height={6.5} rx={2} fill={PRIMARY} />
    <text x={77} y={53.8} textAnchor="middle" fontSize={4.6} fontWeight={700} fill="#fff">
      Copy to Clipboard
    </text>
  </svg>
);

const PostmanKeySteps: React.FC = () => {
  const { token } = theme.useToken();

  const stepIndex: React.CSSProperties = {
    flexShrink: 0,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: token.colorPrimary,
    color: token.colorTextLightSolid,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 10,
  };

  // Cards are direct children of the stretch-aligned flex row: equal
  // widths via `flex: 1 1 0`, equal heights via the stretch.
  const stepCard: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    flex: '1 1 0',
    minWidth: 0,
  };

  const caption = (index: number, lines: [string, string]): React.ReactNode => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, textAlign: 'left', minWidth: 0 }}>
      <span style={stepIndex}>{index}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {lines.map((line) => (
          <Text key={line} style={{ fontSize: 11, lineHeight: '14px' }}>
            {line}
          </Text>
        ))}
      </div>
    </div>
  );

  const steps: React.ReactNode[] = [
    <div key="menu" style={stepCard} data-testid="oh-postman-key-step-menu">
      <AccountMenuGlyph />
      {caption(1, [
        'In the Postman app or on postman.co,',
        'open the top-right settings menu and choose Account settings.',
      ])}
    </div>,
    <div key="generate" style={stepCard} data-testid="oh-postman-key-step-generate">
      <GenerateKeyGlyph />
      {caption(2, ['Pick API keys in the sidebar,', 'then Generate API key.'])}
    </div>,
    <div key="copy" style={stepCard} data-testid="oh-postman-key-step-copy">
      <CopyKeyGlyph />
      {caption(3, ['Copy the key — it is shown only once —', 'and paste it above.'])}
    </div>,
  ];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 6, marginTop: 24, width: '100%' }}
      data-testid="oh-postman-key-steps"
    >
      {steps.map((step, i) => (
        <Fragment key={['menu', 'generate', 'copy'][i]}>
          {step}
          {i < steps.length - 1 && (
            <ArrowRightOutlined
              style={{ fontSize: 10, color: token.colorTextQuaternary, flexShrink: 0, alignSelf: 'center' }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
};

export default PostmanKeySteps;
