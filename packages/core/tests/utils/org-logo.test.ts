import { describe, expect, it } from 'vitest';
import {
  isValidOrgLogoDataUri,
  ORG_LOGO_MAX_BYTES,
  ORG_LOGO_MAX_DATA_URI_LENGTH,
  validateOrgLogoDataUri,
} from '../../src/utils/org-logo';

/** 1×1 transparent PNG — a genuine payload with the real signature. */
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function bytesToBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const SAFE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#f60"/></svg>';

describe('validateOrgLogoDataUri', () => {
  it('accepts a genuine PNG', () => {
    expect(validateOrgLogoDataUri(`data:image/png;base64,${PNG_1PX}`)).toEqual({ ok: true, mime: 'image/png' });
  });

  it('accepts JPEG and WebP payloads with matching signatures', () => {
    const jpeg = bytesToBase64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(validateOrgLogoDataUri(`data:image/jpeg;base64,${jpeg}`).ok).toBe(true);
    const webp = bytesToBase64([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(validateOrgLogoDataUri(`data:image/webp;base64,${webp}`).ok).toBe(true);
  });

  it('accepts a plain, self-contained SVG', () => {
    expect(validateOrgLogoDataUri(svgDataUri(SAFE_SVG))).toEqual({ ok: true, mime: 'image/svg+xml' });
  });

  it('rejects non-data-URI strings', () => {
    expect(validateOrgLogoDataUri('https://openheaders.io/logo.png')).toEqual({
      ok: false,
      reason: 'not-a-data-uri',
    });
    expect(validateOrgLogoDataUri('')).toEqual({ ok: false, reason: 'not-a-data-uri' });
  });

  it('rejects formats outside the allow-list', () => {
    expect(validateOrgLogoDataUri(`data:image/gif;base64,${PNG_1PX}`)).toEqual({
      ok: false,
      reason: 'unsupported-format',
    });
    expect(validateOrgLogoDataUri(`data:text/html;base64,${btoa('<html></html>')}`)).toEqual({
      ok: false,
      reason: 'unsupported-format',
    });
  });

  it('rejects a payload whose bytes do not match the declared format', () => {
    // Declared PNG, actually SVG text.
    expect(validateOrgLogoDataUri(`data:image/png;base64,${btoa(SAFE_SVG)}`)).toEqual({
      ok: false,
      reason: 'corrupt-image',
    });
  });

  it('rejects malformed base64', () => {
    expect(validateOrgLogoDataUri('data:image/png;base64,@@@@')).toEqual({ ok: false, reason: 'not-base64' });
    expect(validateOrgLogoDataUri('data:image/png;base64,abc')).toEqual({ ok: false, reason: 'not-base64' });
  });

  it('rejects payloads over the byte cap and URIs over the string cap', () => {
    const oversized = `data:image/png;base64,${'A'.repeat(Math.ceil((ORG_LOGO_MAX_BYTES + 8) / 3) * 4)}`;
    expect(validateOrgLogoDataUri(oversized)).toEqual({ ok: false, reason: 'too-large' });
    expect(validateOrgLogoDataUri(`data:image/png;base64,${'A'.repeat(ORG_LOGO_MAX_DATA_URI_LENGTH)}`)).toEqual({
      ok: false,
      reason: 'too-large',
    });
  });

  it('rejects SVG with active content or external references', () => {
    const unsafe = [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://openheaders.io/x.png"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="//openheaders.io/defs.svg#a"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:url(https://openheaders.io/f)}</style></svg>',
    ];
    for (const svg of unsafe) {
      expect(validateOrgLogoDataUri(svgDataUri(svg)), svg).toEqual({ ok: false, reason: 'unsafe-svg' });
    }
    // Internal defs references stay legal.
    const internalUse =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><g id="a"><rect/></g></defs><use href="#a"/></svg>';
    expect(validateOrgLogoDataUri(svgDataUri(internalUse)).ok).toBe(true);
  });

  it('rejects an svg+xml payload with no <svg> root as corrupt', () => {
    expect(validateOrgLogoDataUri(`data:image/svg+xml;base64,${btoa('just text')}`)).toEqual({
      ok: false,
      reason: 'corrupt-image',
    });
  });

  it('mirrors through the boolean form', () => {
    expect(isValidOrgLogoDataUri(`data:image/png;base64,${PNG_1PX}`)).toBe(true);
    expect(isValidOrgLogoDataUri('data:image/png;base64,')).toBe(false);
  });
});
