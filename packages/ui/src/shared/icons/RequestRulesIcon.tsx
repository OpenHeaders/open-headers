/**
 * RequestRulesIcon — opposing request/response arrows, traffic modified in
 * both directions. Shared glyph for the rules-on-requests concept: the
 * workbench HTTP Rules tab and the panel Request Rules tab render the same
 * drawing so the two surfaces read as one feature. Drawn on a 16x16 grid
 * with 1.5px strokes and wrapped in antd's Icon so it inherits `.anticon`
 * sizing and currentColor like every stock tab icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';

const RequestRulesSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 4.75h10.25" />
    <path d="m10 2 3 2.75L10 7.5" />
    <path d="M13.5 11.25H3.25" />
    <path d="m6 8.5-3 2.75L6 14" />
  </svg>
);

export const RequestRulesIcon: React.FC = () => <Icon component={RequestRulesSvg} />;
