/**
 * Viewer-side surface display-label composition. The wire carries a
 * structured `surfaceKind` + raw `labelContext`; the display label is
 * composed in the viewer's locale. Pins the English output to what
 * author-side composition produced before the structured split.
 */

import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { surfaceDisplayLabel, surfaceKindLabel } from '@openheaders/ui/shared/awareness/surface-label';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

describe('surfaceKindLabel', () => {
  it('maps every kind to its canonical English label', () => {
    expect(t(surfaceKindLabel('workbench'))).toBe('Workbench');
    expect(t(surfaceKindLabel('popup'))).toBe('Popup');
    expect(t(surfaceKindLabel('devpanel'))).toBe('DevTools panel');
    expect(t(surfaceKindLabel('sidepanel'))).toBe('Side panel');
  });
});

describe('surfaceDisplayLabel', () => {
  it('falls back to the translated kind label without context', () => {
    expect(surfaceDisplayLabel(t, { surfaceKind: 'devpanel' })).toBe('DevTools panel');
    expect(surfaceDisplayLabel(t, { surfaceKind: 'popup' })).toBe('Popup');
  });

  it('renders own-tab context verbatim (the tab title names the surface)', () => {
    expect(surfaceDisplayLabel(t, { surfaceKind: 'workbench', labelContext: '#4 New Header Rule — Open Headers' })).toBe(
      '#4 New Header Rule — Open Headers',
    );
  });

  it('frames the devpanel inspected-page context viewer-side', () => {
    expect(surfaceDisplayLabel(t, { surfaceKind: 'devpanel', labelContext: 'staging.openheaders.io' })).toBe(
      'DevTools — staging.openheaders.io',
    );
  });
});
