/**
 * Status-chip vocabulary shared by the settled / live meta strips, the
 * redirect-chain facts and the example editor's status picker: the
 * range→tone palette, the canonical reason-phrase fallback (HTTP/2
 * carries no reason phrase on the wire, so `statusText` is often
 * empty — the chip still reads `200 OK`), and the filled-pill style.
 */

import { useUiTheme } from '@openheaders/ui/context';
import { statusCodePhrase } from '@openheaders/ui/shared/info-popover/data/http-status';
import { theme } from 'antd';
import type React from 'react';

/** `200 OK` — the server's own phrase when it sent one, the canonical
 *  reason phrase otherwise, the bare code for unknown codes. */
export function statusDisplayLabel(status: number, statusText: string): string {
  const phrase = statusText || statusCodePhrase(status) || '';
  return phrase ? `${status} ${phrase}` : `${status}`;
}

/**
 * Filled pill, tinted by range: 2xx success, 4xx warning, 5xx error,
 * everything else (1xx / 3xx / no status yet) neutral.
 *
 * Both pairs derive from the tone hue rather than the theme's paired
 * `color*Text` / `color*Bg` tokens — those run vivid (light) or muddy
 * (dark). Text mixes the hue toward the theme's text pole (near-black
 * on light, near-white on dark) for a muted, readable tint; the fill
 * is a soft wash of the hue over the container background.
 */
export function useStatusPillStyle(status: number | null): React.CSSProperties {
  const { token } = theme.useToken();
  const { isDarkMode } = useUiTheme();
  const range =
    status === null
      ? 'neutral'
      : status >= 500
        ? 'error'
        : status >= 400
          ? 'warning'
          : status >= 200 && status < 300
            ? 'success'
            : 'neutral';
  let text: string;
  let bg: string;
  if (range === 'neutral') {
    text = token.colorTextSecondary;
    bg = token.colorFillTertiary;
  } else {
    const hue = range === 'error' ? token.colorError : range === 'warning' ? token.colorWarning : token.colorSuccess;
    if (isDarkMode) {
      text = `color-mix(in srgb, ${hue} 22%, ${token.colorWhite})`;
      bg = `color-mix(in srgb, ${hue} 32%, ${token.colorBgContainer})`;
    } else {
      text = `color-mix(in srgb, ${hue} 55%, ${token.colorText})`;
      bg = `color-mix(in srgb, ${hue} 9%, ${token.colorBgContainer})`;
    }
  }
  return {
    color: text,
    background: bg,
    borderColor: 'transparent',
    fontWeight: 600,
    marginInlineEnd: 0,
  };
}
