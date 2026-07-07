/**
 * Custom SVG glyphs for workbench tool-window tabs whose concepts have no
 * faithful stock icon. Each glyph is drawn on a 16x16 grid with 1.5px
 * strokes and wrapped in antd's Icon so it inherits `.anticon` sizing and
 * currentColor like every stock tab icon.
 */

import Icon from '@ant-design/icons';
import type React from 'react';

type SvgProps = React.SVGProps<SVGSVGElement>;

/** Opposing request/response arrows — traffic modified in both directions. */
const HttpRulesSvg: React.FC<SvgProps> = (props) => (
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

/** Paper plane — send a request. */
const ApiRequestsSvg: React.FC<SvgProps> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 1.5 1.5 6.8l5.2 2.1 2 5.1z" />
    <path d="M6.7 8.9 14.5 1.5" />
  </svg>
);

/** Braces around an x — the `{{variable}}` template syntax. */
const VariablesSvg: React.FC<SvgProps> = (props) => (
  <svg
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5.4 2c-1.6 0-2.2.7-2.2 2.1v1.6c0 1-.5 1.7-1.6 2.3 1.1.6 1.6 1.3 1.6 2.3v1.6c0 1.4.6 2.1 2.2 2.1" />
    <path d="M10.6 2c1.6 0 2.2.7 2.2 2.1v1.6c0 1 .5 1.7 1.6 2.3-1.1.6-1.6 1.3-1.6 2.3v1.6c0 1.4-.6 2.1-2.2 2.1" />
    <path d="m6.8 6.6 2.4 2.8" />
    <path d="M9.2 6.6 6.8 9.4" />
  </svg>
);

export const HttpRulesIcon: React.FC = () => <Icon component={HttpRulesSvg} />;
export const ApiRequestsIcon: React.FC = () => <Icon component={ApiRequestsSvg} />;
export const VariablesIcon: React.FC = () => <Icon component={VariablesSvg} />;
