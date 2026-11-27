/**
 * The sizes of the workflow view's panel (the workflow runs plan,
 * Decisions log, S22): one size under the design's, as the whole view
 * is — its controls the small ones, its text a size down, both on the
 * app's UI scale. The stylesheet sizes the panel's own text from the one
 * number.
 */

import { useTheme } from '@openheaders/ui/context/ThemeContext';
import { useMemo } from 'react';

/** The panel's text, a size under the app's own. */
const PANEL_FONT_SIZE = 12;

export function usePanelSizes(): { fontSize: number; theme: { token: { fontSize: number } } } {
  const { uiScale } = useTheme();
  const fontSize = Math.round(PANEL_FONT_SIZE * uiScale);
  const theme = useMemo(() => ({ token: { fontSize } }), [fontSize]);
  return { fontSize, theme };
}
