/**
 * One glyph per concrete auth type — the scheme icons say what the
 * scheme IS (a key, a password field, a boxed B / H, a lock, a
 * signature, the JWT pinwheel, a circled A with the version) rather
 * than borrowing a stock security glyph; the three vendor signatures
 * carry a simplified mark in the vendor's colour. All on the shared
 * 16×16 grid with hairline (1.1px) strokes and wrapped in antd's Icon, so they
 * size and colour like every stock icon wherever a type is named —
 * the empty-state cards, the type menus and selects, the entry rows.
 */

import Icon from '@ant-design/icons';
import type React from 'react';
import type { GlyphIconProps } from '@openheaders/ui/shared/icons';
import type { ConcreteAuthType } from './auth-config-form';

type Svg = React.FC<React.SVGProps<SVGSVGElement>>;

/** A stroked glyph on the 16-grid — round caps, hairline. */
const stroked = (children: React.ReactNode): Svg => {
  const StrokedSvg: Svg = (props) => (
    <svg
      {...props}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
  return StrokedSvg;
};

/** A key: the bow, the shaft, two teeth. */
const ApiKeySvg = stroked(
  <>
    <circle cx="4.75" cy="8" r="2.75" />
    <path d="M7.5 8h7" />
    <path d="M12 8v2.5" />
    <path d="M14.5 8v2" />
  </>,
);

/** A password field: the box with three masked characters. */
const BasicSvg = stroked(
  <>
    <rect x="1.5" y="4.5" width="13" height="7" rx="1.5" />
    <path d="M5 8h.01" strokeWidth={1.6} />
    <path d="M8 8h.01" strokeWidth={1.6} />
    <path d="M11 8h.01" strokeWidth={1.6} />
  </>,
);

/** A boxed B. */
const BearerSvg = stroked(
  <>
    <rect x="2" y="2" width="12" height="12" rx="2.5" />
    <path d="M6 4.75v6.5" />
    <path d="M6 4.75h2.9a1.625 1.625 0 0 1 0 3.25H6" />
    <path d="M6 8h3.4a1.625 1.625 0 0 1 0 3.25H6" />
  </>,
);

/** A padlock. */
const DigestSvg = stroked(
  <>
    <rect x="3" y="7.25" width="10" height="7" rx="1.5" />
    <path d="M5.25 7.25V5a2.75 2.75 0 0 1 5.5 0v2.25" />
    <path d="M8 10.75h.01" strokeWidth={1.6} />
  </>,
);

/** A boxed H. */
const HawkSvg = stroked(
  <>
    <rect x="2" y="2" width="12" height="12" rx="2.5" />
    <path d="M5.75 4.75v6.5" />
    <path d="M10.25 4.75v6.5" />
    <path d="M5.75 8h4.5" />
  </>,
);

/** A signature over its line. */
const HttpSignatureSvg = stroked(
  <>
    <path d="M2.5 13.75h11" />
    <path d="M2.5 11c1.9-.4 3.5-2.6 4-5.8.1-.9-.7-1.2-1-.3-.7 2.2-.5 5 1 6 1 .7 2.2-.1 3.4-.5 1.2-.4 2.2.1 3.6.4" />
  </>,
);

/** The six-spoke JWT pinwheel. */
const JwtSvg = stroked(
  <g strokeWidth={1.3}>
    <path d="M8 10.5v4.25" />
    <path d="M8 5.5V1.25" />
    <path d="m10.17 9.25 3.68 2.125" />
    <path d="M5.83 6.75 2.15 4.625" />
    <path d="m5.83 9.25-3.68 2.125" />
    <path d="m10.17 6.75 3.68-2.125" />
  </g>,
);

/** A circled A with the version digit at its shoulder. */
const oauthSvg = (digit: React.ReactNode): Svg =>
  stroked(
    <>
      <circle cx="6.5" cy="7" r="5.25" />
      <path d="m4.5 10 2-5.75 2 5.75" />
      <path d="M5.25 8.1h2.5" />
      {digit}
    </>,
  );

const OAuth1Svg = oauthSvg(<path d="m12.4 11.4 1.35-1.1V15" />);
const OAuth2Svg = oauthSvg(<path d="M12 11.3a1.5 1.5 0 0 1 2.9.5c0 1.3-2.9 2.1-2.9 3.2h3" />);

/** A circle struck through. */
const NoneSvg = stroked(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="m3.75 3.75 8.5 8.5" />
  </>,
);

/** The aws wordmark — drawn, never text, so it stays out of the
 *  label's text content — over its smile in Amazon orange. */
const AwsSigV4Svg: Svg = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="none" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
    <g stroke="currentColor">
      <circle cx="3.9" cy="5.4" r="1.55" />
      <path d="M5.45 3.85v3.1" />
      <path d="m6.9 3.85.85 3.1.85-2.4.85 2.4.85-3.1" />
      <path d="M13.5 4.2c-.35-.45-1.6-.6-2.05-.05-.55.85 2.15.75 1.95 1.8-.15.65-1.45.9-2.15.25" />
    </g>
    <g stroke="#ff9900" strokeWidth={1.2}>
      <path d="M2.25 10.5c2.6 2.6 8.9 2.6 11.5 0" />
      <path d="m11.9 9.25 1.85 1.25-1.6 1.6" />
    </g>
  </svg>
);

/** The Akamai wave — an open crescent with its inner curl, Akamai blue. */
const EdgeGridSvg: Svg = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="none" stroke="#0096d6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.75 4.25A5.75 5.75 0 1 0 12.75 11.75" strokeWidth={1.7} />
    <path d="M5.5 8.75c.6-2.4 3.1-3.7 6.75-2.75" strokeWidth={1.3} />
  </svg>
);

/** The Atlassian A — a small blade and the tall spike, Atlassian blue. */
const AsapSvg: Svg = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="#2684ff">
    <path d="M5.05 7.45c-.35-.45-1-.4-1.3.1L.15 14.3c-.25.45.05 1 .55 1h5.15c.2 0 .35-.1.45-.3 1.15-2.35.45-5.95-1.25-7.55z" />
    <path d="M7.45.45c-2.05 3.25-1.95 6.9-.6 9.6l2.5 5c.1.15.3.25.45.25h5.15c.5 0 .8-.55.55-1L8.35.45c-.2-.4-.7-.4-.9 0z" />
  </svg>
);

const AUTH_TYPE_SVGS: Record<ConcreteAuthType, Svg> = {
  'api-key': ApiKeySvg,
  basic: BasicSvg,
  bearer: BearerSvg,
  digest: DigestSvg,
  hawk: HawkSvg,
  'http-signature': HttpSignatureSvg,
  jwt: JwtSvg,
  oauth1: OAuth1Svg,
  oauth2: OAuth2Svg,
  'aws-sigv4': AwsSigV4Svg,
  edgegrid: EdgeGridSvg,
  asap: AsapSvg,
  none: NoneSvg,
};

export const AuthTypeIcon: React.FC<GlyphIconProps & { type: ConcreteAuthType }> = ({ type, ...props }) => (
  <Icon component={AUTH_TYPE_SVGS[type]} {...props} />
);
