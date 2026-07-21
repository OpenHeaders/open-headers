/**
 * Colored browser roundels for the Traffic Monitor's source rail —
 * compact inline SVGs evoking each browser family's mark (geometric
 * approximations drawn here, not imported brand artwork). 16px by
 * default; gradient ids are namespaced and stable so repeated
 * instances share one definition per document.
 */

import { GlobalOutlined } from '@ant-design/icons';
import type React from 'react';

export interface BrandIconProps {
  size?: number;
}

function ChromeBrandIcon({ size = 16 }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M21.53 6.5A11 11 0 0 0 2.47 6.5L6.98 9.1a5.8 5.8 0 0 1 10.04 0Z" fill="#EA4335" />
      <path d="M2.47 6.5A11 11 0 0 0 12 23l0-5.2a5.8 5.8 0 0 1-5.02-8.7Z" fill="#34A853" />
      <path d="M12 23a11 11 0 0 0 9.53-16.5L17.02 9.1A5.8 5.8 0 0 1 12 17.8Z" fill="#FBBC05" />
      <circle cx="12" cy="12" r="5.8" fill="#fff" />
      <circle cx="12" cy="12" r="4.5" fill="#4285F4" />
    </svg>
  );
}

function FirefoxBrandIcon({ size = 16 }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id="oh-brand-ff" cx="35%" cy="20%" r="90%">
          <stop offset="0%" stopColor="#FFDB4D" />
          <stop offset="45%" stopColor="#FF9500" />
          <stop offset="100%" stopColor="#E3350F" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#oh-brand-ff)" />
      <path d="M5.2 5.6c3.2-1.2 7.4-.4 9.4 2.2 1.6 2 1.9 4.9.6 7.2 2.4-1 3.8-3.6 3.5-6.2 1.5 3.4.5 7.6-2.6 9.7a8.6 8.6 0 0 1-10.9-13z" fill="rgba(255,255,255,0.22)" />
    </svg>
  );
}

function SafariBrandIcon({ size = 16 }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id="oh-brand-safari" cx="50%" cy="30%" r="90%">
          <stop offset="0%" stopColor="#19D7FF" />
          <stop offset="100%" stopColor="#1B88E5" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#oh-brand-safari)" />
      <polygon points="17.2,6.8 10.7,10.7 13.3,13.3" fill="#FF3B30" />
      <polygon points="6.8,17.2 13.3,13.3 10.7,10.7" fill="#fff" />
    </svg>
  );
}

function EdgeBrandIcon({ size = 16 }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="oh-brand-edge" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0C59A4" />
          <stop offset="100%" stopColor="#2BC3D2" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#oh-brand-edge)" />
      <path d="M3.4 15.5a9.3 9.3 0 0 0 16.8 2.6c-2.3 1.4-5.2 1.8-8.1.9-3.9-1.3-7-3.5-8.7-3.5z" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

/** Colored roundel for a browser family; a neutral globe otherwise. */
export function BrowserBrandIcon({ name, size = 16 }: BrandIconProps & { name: string }): React.ReactElement {
  switch (name) {
    case 'Chrome':
      return <ChromeBrandIcon size={size} />;
    case 'Firefox':
      return <FirefoxBrandIcon size={size} />;
    case 'Safari':
      return <SafariBrandIcon size={size} />;
    case 'Edge':
      return <EdgeBrandIcon size={size} />;
    default:
      return <GlobalOutlined style={{ fontSize: size - 2 }} />;
  }
}
