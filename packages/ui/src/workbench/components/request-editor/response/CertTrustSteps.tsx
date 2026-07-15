/**
 * CertTrustSteps — compact three-step walkthrough for trusting a
 * self-signed certificate, rendered under the response error state
 * when a send fails with a certificate rejection (`open-in-tab` hint):
 * open the URL in a tab → accept the browser's warning → send again.
 *
 * Each step pairs a minimalist theme-token SVG (same visual language
 * as the popup's DevtoolsMenuGlyph browser frames) with a one-line
 * caption. `direction` follows the response pane's shape: a stacked
 * editor split gives a wide pane → steps in a row; a side-by-side
 * split gives a narrow pane → steps stacked. Step 2's caption adapts
 * to the browser — Firefox's interstitial says "Accept the Risk and
 * Continue" where Chromium says "Proceed (unsafe)".
 */

import { ArrowRightOutlined, ExportOutlined } from '@ant-design/icons';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isFirefox } from '@openheaders/ui/shared/platform';

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
const ERROR = 'var(--ant-color-error)';
const SUCCESS = 'var(--ant-color-success)';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/** Shared mini browser chrome — title bar with traffic lights. */
const FrameChrome: React.FC<{ titleH: number }> = ({ titleH }) => (
  <g>
    <rect x={1} y={1} width={118} height={titleH} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
    {[0, 1, 2].map((i) => (
      <circle key={i} cx={7 + i * 6} cy={1 + titleH / 2} r={1.8} fill={GREY} />
    ))}
  </g>
);

/** Step 1 — a fresh tab with the request URL in the address bar. */
const OpenTabGlyph: React.FC = () => (
  <svg viewBox="0 0 120 62" width={GLYPH_W} height={GLYPH_H} aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x={1} y={1} width={118} height={60} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
    <FrameChrome titleH={8} />
    {/* Tab strip — dim existing tab, highlighted NEW tab */}
    <rect x={1} y={9} width={118} height={11} fill={FILL_SECONDARY} stroke={BORDER} />
    <rect x={5} y={11} width={30} height={9} rx={2.5} fill={FILL_TERTIARY} />
    <rect x={38} y={11} width={52} height={9} rx={2.5} fill={BG_CONTAINER} stroke={PRIMARY} />
    <text x={43} y={17.8} fontSize={5.5} fontWeight={700} fill={TEXT} fontFamily={MONO}>
      new tab
    </text>
    <circle cx={100} cy={15.5} r={4} fill={PRIMARY} />
    <text x={100} y={18} textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff">
      +
    </text>
    {/* Address bar with the https URL */}
    <rect x={6} y={24} width={108} height={10} rx={5} fill={FILL_TERTIARY} />
    <text x={13} y={31} fontSize={6} fill={TEXT_DIM} fontFamily={MONO}>
      https://127.0.0.1:3443
    </text>
    {/* Faded body rows */}
    <g opacity={0.4}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={8} y={40 + i * 6.5} width={104 - i * 26} height={3} rx={1.5} fill={FILL_TERTIARY} />
      ))}
    </g>
  </svg>
);

/** Step 2 — the certificate interstitial with the accept path lit. */
const AcceptWarningGlyph: React.FC<{ proceedLabel: string }> = ({ proceedLabel }) => (
  <svg viewBox="0 0 120 62" width={GLYPH_W} height={GLYPH_H} aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x={1} y={1} width={118} height={60} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
    <FrameChrome titleH={8} />
    {/* Warning triangle */}
    <path d="M 16 26 L 23 13 L 30 26 Z" fill={ERROR} />
    <rect x={22.3} y={17} width={1.6} height={5} rx={0.8} fill="#fff" />
    <circle cx={23.1} cy={24} r={1} fill="#fff" />
    {/* "Your connection is not private" placeholder lines */}
    <rect x={38} y={15} width={64} height={3.4} rx={1.7} fill={FILL_SECONDARY} />
    <rect x={38} y={22} width={46} height={2.6} rx={1.3} fill={FILL_TERTIARY} />
    {/* Advanced button (outlined, dim) */}
    <rect x={16} y={36} width={38} height={11} rx={5.5} fill={BG_CONTAINER} stroke={BORDER} />
    <text x={35} y={43.4} textAnchor="middle" fontSize={6} fill={TEXT_DIM}>
      Advanced
    </text>
    {/* Proceed link — the step's action, primary + underlined */}
    <text x={16} y={56} fontSize={6} fontWeight={700} fill={PRIMARY} textDecoration="underline">
      {proceedLabel}
    </text>
  </svg>
);

/** Step 3 — back in the workbench, Send lit, a green 200 landing. */
const SendAgainGlyph: React.FC = () => (
  <svg viewBox="0 0 120 62" width={GLYPH_W} height={GLYPH_H} aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x={1} y={1} width={118} height={60} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
    {/* Method chip + URL field + Send button */}
    <rect x={6} y={6} width={20} height={11} rx={2.5} fill={FILL_TERTIARY} />
    <text x={16} y={13.8} textAnchor="middle" fontSize={5.5} fontWeight={700} fill={SUCCESS} fontFamily={MONO}>
      GET
    </text>
    <rect x={29} y={6} width={56} height={11} rx={2.5} fill={BG_CONTAINER} stroke={BORDER} />
    <text x={33} y={13.8} fontSize={5.5} fill={TEXT_DIM} fontFamily={MONO}>
      https://…
    </text>
    <rect x={88} y={6} width={26} height={11} rx={2.5} fill={PRIMARY} />
    <text x={103} y={13.8} textAnchor="middle" fontSize={6} fontWeight={700} fill="#fff">
      ▶ Send
    </text>
    {/* Response area — green status + body rows */}
    <rect x={6} y={22} width={108} height={34} rx={3} fill={FILL_TERTIARY} opacity={0.5} />
    <rect x={11} y={27} width={22} height={8} rx={2} fill={SUCCESS} opacity={0.9} />
    <text x={22} y={33} textAnchor="middle" fontSize={5.5} fontWeight={700} fill="#fff" fontFamily={MONO}>
      200
    </text>
    {[0, 1, 2].map((i) => (
      <rect key={i} x={11} y={40 + i * 5.5} width={98 - i * 30} height={2.6} rx={1.3} fill={FILL_SECONDARY} />
    ))}
  </svg>
);

interface CertTrustStepsProps {
  /** The https URL to open — the failed request's target. */
  url: string;
  /** Row of steps (wide pane) vs stacked steps (narrow pane). */
  direction: 'horizontal' | 'vertical';
}

const CertTrustSteps: React.FC<CertTrustStepsProps> = ({ url, direction }) => {
  const { token } = theme.useToken();
  const t = useT();
  const horizontal = direction === 'horizontal';

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

  const stepCard: React.CSSProperties = {
    display: 'flex',
    flexDirection: horizontal ? 'column' : 'row',
    alignItems: horizontal ? 'center' : 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
  };

  const caption = (index: number, lines: React.ReactNode): React.ReactNode => (
    <div
      style={{
        display: 'flex',
        alignItems: horizontal ? 'flex-start' : 'center',
        gap: 6,
        textAlign: 'left',
        minWidth: 0,
      }}
    >
      <span style={stepIndex}>{index}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>{lines}</div>
    </div>
  );

  const proceedLabel = isFirefox ? 'Accept the Risk and Continue' : 'Proceed (unsafe)';

  const steps: React.ReactNode[] = [
    <div key="open" style={stepCard} data-testid="oh-cert-step-open">
      <OpenTabGlyph />
      {caption(
        1,
        <>
          <Text style={{ fontSize: 11, lineHeight: '14px' }}>
            {t('workbench.editors.request.response.error.certSteps.step1')}
          </Text>
          <Button
            size="small"
            icon={<ExportOutlined />}
            data-testid="oh-response-error-open-tab"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => window.open(url, '_blank', 'noopener')}
          >
            {t('workbench.editors.request.response.error.openInTab')}
          </Button>
        </>,
      )}
    </div>,
    <div key="accept" style={stepCard} data-testid="oh-cert-step-accept">
      <AcceptWarningGlyph proceedLabel={proceedLabel} />
      {caption(
        2,
        <>
          <Text style={{ fontSize: 11, lineHeight: '14px' }}>
            {t('workbench.editors.request.response.error.certSteps.step2')}
          </Text>
          <Text type="secondary" style={{ fontSize: 10, lineHeight: '13px' }}>
            {t(
              isFirefox
                ? 'workbench.editors.request.response.error.certSteps.step2DetailFirefox'
                : 'workbench.editors.request.response.error.certSteps.step2DetailChromium',
            )}
          </Text>
        </>,
      )}
    </div>,
    <div key="retry" style={stepCard} data-testid="oh-cert-step-retry">
      <SendAgainGlyph />
      {caption(
        3,
        <Text style={{ fontSize: 11, lineHeight: '14px' }}>
          {t('workbench.editors.request.response.error.certSteps.step3')}
        </Text>,
      )}
    </div>,
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        alignItems: horizontal ? 'stretch' : 'stretch',
        gap: 6,
        marginTop: 8,
        maxWidth: horizontal ? 640 : 320,
      }}
      data-testid="oh-cert-trust-steps"
    >
      {steps.map((step, i) => (
        <div
          key={['open', 'accept', 'retry'][i]}
          style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', alignItems: 'center', gap: 6, minWidth: 0 }}
        >
          {step}
          {i < steps.length - 1 && (
            <ArrowRightOutlined
              style={{
                fontSize: 10,
                color: token.colorTextQuaternary,
                transform: horizontal ? 'none' : 'rotate(90deg)',
                flexShrink: 0,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default CertTrustSteps;
