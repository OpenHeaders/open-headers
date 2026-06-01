/**
 * Carries the BackendPane's previewed mode down to the connection-field
 * editors (the Authentication field's pairing glyph), which are rendered
 * through the settings registry and otherwise only receive their `def`.
 *
 * Null outside the pane (settings search), where there's no preview and
 * the field degrades to no glyph.
 */

import { createContext, useContext } from 'react';
import type { BackendMode } from '../schema/backend';
import type { BackendIconKey } from './backend-icons';

const PreviewModeContext = createContext<BackendMode | null>(null);

export const BackendPreviewModeProvider = PreviewModeContext.Provider;

export function useBackendPreviewMode(): BackendMode | null {
  return useContext(PreviewModeContext);
}

const MODE_ICON: Record<BackendMode, BackendIconKey> = {
  'in-browser': 'browser',
  'desktop-app': 'desktop',
  'local-self-hosted': 'daemon',
  'remote-self-hosted': 'vm',
};

/** The back-end-tier glyph for a mode — the same icon the picker tiles use. */
export function backendModeIcon(mode: BackendMode): BackendIconKey {
  return MODE_ICON[mode];
}
