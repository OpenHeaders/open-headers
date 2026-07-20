/**
 * LanguageIcon — the two-square language glyph: a filled rounded square
 * carrying the current locale's short mark (En, Fr, Es, De, 中, …) with a
 * smaller outlined square tucked at its corner carrying the counterpart
 * script mark (文 for Latin locales, A for CJK), so the pair always reads
 * as "switch language" rather than a flag. The main glyph is knocked out
 * of the filled square via a mask, which also carves the gap around the
 * small square, so the icon works on any background in both themes.
 * Wrapped in antd's Icon so it inherits `.anticon` sizing and currentColor.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import { useId, useMemo } from 'react';
import type { GlyphIconProps } from './types';

interface LocaleGlyph {
  /** Mark knocked out of the filled square. */
  main: string;
  /** Whether the main mark is a single CJK ideograph (drawn larger). */
  cjk: boolean;
}

const CJK_MARKS: Readonly<Record<string, string>> = {
  'zh-CN': '中',
};

function glyphFor(locale: string): LocaleGlyph {
  const cjkMark = CJK_MARKS[locale];
  if (cjkMark !== undefined) return { main: cjkMark, cjk: true };
  const base = locale.split('-')[0];
  return { main: base.charAt(0).toUpperCase() + base.slice(1, 2), cjk: false };
}

function makeLanguageSvg(locale: string): React.FC<React.SVGProps<SVGSVGElement>> {
  const { main, cjk } = glyphFor(locale);
  const alt = cjk ? 'A' : '文';
  const LanguageSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
    const maskId = useId();
    return (
      <svg {...props} viewBox="0 0 16 16" fill="none">
        <mask id={maskId}>
          <rect width="16" height="16" fill="#fff" />
          <text
            x="5.85"
            y="6.15"
            fill="#000"
            fontSize={cjk ? 7.5 : 6}
            fontWeight={600}
            fontFamily="system-ui, sans-serif"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {main}
          </text>
          <rect x="7.4" y="7.4" width="9" height="9" rx="2.4" fill="#000" />
        </mask>
        <rect x="0.5" y="0.5" width="10.7" height="10.7" rx="2" fill="currentColor" mask={`url(#${maskId})`} />
        <rect x="8.65" y="8.65" width="6.35" height="6.35" rx="1.4" stroke="currentColor" strokeWidth="1.1" />
        <text
          x="11.85"
          y="12.05"
          fill="currentColor"
          fontSize={cjk ? 4.4 : 4.8}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {alt}
        </text>
      </svg>
    );
  };
  return LanguageSvg;
}

export interface LanguageIconProps extends GlyphIconProps {
  /** Resolved locale code the icon should depict (never `auto`). */
  locale: string;
}

export const LanguageIcon: React.FC<LanguageIconProps> = ({ locale, ...props }) => {
  const component = useMemo(() => makeLanguageSvg(locale), [locale]);
  return <Icon component={component} {...props} />;
};
