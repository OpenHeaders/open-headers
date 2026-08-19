import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_GREEN,FILL_PURPLE,STROKE,STROKE_GREEN,STROKE_PURPLE,TEXT,TEXT_DIM } from '../_shared';

/**
 * URL Pattern — wildcard anatomy + match/no-match examples.
 *
 * Shows the pattern as three colored segments:
 *   - gold = wildcard chunks (`*://` and `/*`) — match anything
 *   - green = literal host (must match exactly)
 *
 * Below the pattern, four test URLs marked ✓ / ✗ make the
 * subdomain-mismatch failure mode concrete. Footer points at
 * Request Domains for the "all subdomains" case.
 */
export const UrlPatternDiagram: React.FC = () => {
  const t = useT();
  const wildcardFill = 'rgba(250, 173, 20, 0.18)';
  const wildcardStroke = 'rgba(250, 173, 20, 0.6)';
  const literalFill = FILL_GREEN;
  const literalStroke = STROKE_GREEN;
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.conditions.urlPattern.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlPattern.title')}
      </text>

      {/* Pattern: 3 colored segments rendered side-by-side */}
      <rect x={70} y={26} width={28} height={20} rx={2} fill={wildcardFill} stroke={wildcardStroke} />
      <rect x={98} y={26} width={132} height={20} rx={2} fill={literalFill} stroke={literalStroke} />
      <rect x={230} y={26} width={20} height={20} rx={2} fill={wildcardFill} stroke={wildcardStroke} />

      <text x={84} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        *://
      </text>
      <text x={164} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        api.openheaders.com
      </text>
      <text x={240} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        /*
      </text>

      {/* Connector lines from each segment down to its label */}
      <line x1={84} y1={48} x2={84} y2={60} stroke={wildcardStroke} strokeWidth={1} />
      <line x1={164} y1={48} x2={164} y2={60} stroke={literalStroke} strokeWidth={1} />
      <line x1={240} y1={48} x2={240} y2={60} stroke={wildcardStroke} strokeWidth={1} />

      <text x={84} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlPattern.labelAny')}
      </text>
      <text x={84} y={84} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlPattern.labelProtocol')}
      </text>

      <text x={164} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost')}
      </text>
      <text x={164} y={84} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards')}
      </text>

      <text x={240} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlPattern.labelAnyPath')}
      </text>
      <text x={240} y={84} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlPattern.labelQueryString')}
      </text>

      {/* Color legend */}
      <rect x={20} y={100} width={10} height={10} fill={wildcardFill} stroke={wildcardStroke} />
      <text x={36} y={109} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlPattern.legendWildcard')}
      </text>
      <rect x={170} y={100} width={10} height={10} fill={literalFill} stroke={literalStroke} />
      <text x={186} y={109} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.legendLiteral')}
      </text>

      <line x1={20} y1={124} x2={300} y2={124} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test URLs */}
      <text x={20} y={140} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.testedAgainst')}
      </text>

      <text x={24} y={162} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={162} fontFamily="monospace" fontSize={9} fill={TEXT}>
        https://api.openheaders.com/v2/users
      </text>

      <text x={24} y={180} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={180} fontFamily="monospace" fontSize={9} fill={TEXT}>
        http://api.openheaders.com/health?ok=1
      </text>

      <text x={24} y={206} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={206} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        https://cdn.openheaders.com/img.png
      </text>
      <text x={40} y={218} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain')}
      </text>

      <text x={24} y={240} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={240} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        https://other-site.com/api
      </text>
      <text x={40} y={252} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlPattern.reasonHost')}
      </text>

      {/* Footer suggestion */}
      <rect
        x={14}
        y={272}
        width={292}
        height={42}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={289} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlPattern.footerQ')}
      </text>
      <text x={160} y={303} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.shared.usePrefix')}
        <tspan fontWeight={600}>{t('workbench.docs.diagrams.conditions.urlPattern.footerExample')}</tspan>
        {t('workbench.docs.diagrams.conditions.shared.useSuffix')}
      </text>
    </svg>
  );
};

/**
 * URL Regex — RE2 anatomy + match/no-match examples.
 *
 * Same teaching shape as UrlPatternDiagram but the colors carry
 * regex-specific meaning:
 *   - purple = regex syntax (anchors, character classes, quantifiers)
 *   - green = literal characters
 *
 * Beginners think anything containing a backslash is "regex magic";
 * the diagram makes it explicit that `\.` is just a literal dot —
 * the only real regex bits are `^` (start anchor) and `[0-9]+`
 * (digit class with one-or-more quantifier).
 */
export const UrlRegexDiagram: React.FC = () => {
  const t = useT();
  const regexFill = FILL_PURPLE;
  const regexStroke = STROKE_PURPLE;
  const literalFill = FILL_GREEN;
  const literalStroke = STROKE_GREEN;
  const matchOk = STROKE_GREEN;
  const matchFail = 'var(--ant-color-error)';
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.conditions.urlRegex.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.title')}
      </text>

      {/* Pattern: 3 segments — ^ (regex), literal middle, [0-9]+ (regex) */}
      <rect x={32} y={26} width={14} height={20} rx={2} fill={regexFill} stroke={regexStroke} />
      <rect x={46} y={26} width={198} height={20} rx={2} fill={literalFill} stroke={literalStroke} />
      <rect x={244} y={26} width={44} height={20} rx={2} fill={regexFill} stroke={regexStroke} />

      <text x={39} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        ^
      </text>
      <text x={145} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        https://api\.openheaders\.io/v
      </text>
      <text x={266} y={40} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={600} fill={TEXT}>
        [0-9]+
      </text>

      {/* Connectors */}
      <line x1={39} y1={48} x2={39} y2={60} stroke={regexStroke} strokeWidth={1} />
      <line x1={145} y1={48} x2={145} y2={60} stroke={literalStroke} strokeWidth={1} />
      <line x1={266} y1={48} x2={266} y2={60} stroke={regexStroke} strokeWidth={1} />

      {/* Labels */}
      <text x={39} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.labelStart')}
      </text>
      <text x={39} y={84} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.labelAnchor')}
      </text>

      <text x={145} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars')}
      </text>
      <text x={145} y={84} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlRegex.labelDotNote')}
      </text>

      <text x={266} y={72} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore')}
      </text>
      <text x={266} y={84} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.labelDigits')}
      </text>

      {/* Color legend */}
      <rect x={50} y={100} width={10} height={10} fill={regexFill} stroke={regexStroke} />
      <text x={66} y={109} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlRegex.legendRegex')}
      </text>
      <rect x={210} y={100} width={10} height={10} fill={literalFill} stroke={literalStroke} />
      <text x={226} y={109} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.legendLiteral')}
      </text>

      <line x1={20} y1={124} x2={300} y2={124} stroke={STROKE} strokeDasharray="2 3" />

      {/* Test URLs */}
      <text x={20} y={140} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.shared.testedAgainst')}
      </text>

      <text x={24} y={162} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={162} fontFamily="monospace" fontSize={9} fill={TEXT}>
        https://api.openheaders.com/v2
      </text>

      <text x={24} y={180} fontSize={12} fontWeight={700} fill={matchOk}>
        ✓
      </text>
      <text x={40} y={180} fontFamily="monospace" fontSize={9} fill={TEXT}>
        https://api.openheaders.com/v42/items?q=1
      </text>

      <text x={24} y={206} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={206} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        http://api.openheaders.com/v2
      </text>
      <text x={40} y={218} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlRegex.reasonHttp')}
      </text>

      <text x={24} y={240} fontSize={12} fontWeight={700} fill={matchFail}>
        ✗
      </text>
      <text x={40} y={240} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        https://api.openheaders.com/latest
      </text>
      <text x={40} y={252} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.conditions.urlRegex.reasonLatest')}
      </text>

      {/* Footer hint */}
      <rect
        x={14}
        y={272}
        width={292}
        height={42}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={289} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.footerQ')}
      </text>
      <text x={160} y={303} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix')}
        <tspan fontFamily="monospace" fontWeight={600}>
          ^https?://
        </tspan>
        {t('workbench.docs.diagrams.conditions.urlRegex.footerMid')}
        <tspan fontFamily="monospace" fontWeight={600}>
          ?
        </tspan>
        {t('workbench.docs.diagrams.conditions.urlRegex.footerEnd')}
      </text>
    </svg>
  );
};
