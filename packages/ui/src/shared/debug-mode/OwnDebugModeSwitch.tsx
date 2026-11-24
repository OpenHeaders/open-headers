/**
 * OwnDebugModeSwitch — {@link DebugModeSwitch} bound to THIS browser's own
 * Debug mode: the `inspection.cdpEnabled` switch the footer control drives,
 * with the same chord in its tooltip. For surfaces that run inside the
 * browser extension.
 *
 * Same gating as the footer control: disabled with the Chrome / Edge
 * tooltip where the browser cannot drive its debugger, and nothing at all
 * on a host that is not a browser. The chord itself is bound by the footer
 * control ({@link DebugModePill}); this only names it.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { useChordLabel } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { useSetting, useSettingsReady } from '@openheaders/ui/workbench/settings/hooks';
import type React from 'react';
import { getCurrentHost } from '../host-vocabulary';
import { DebugModeSwitch } from './DebugModeSwitch';

export const OwnDebugModeSwitch: React.FC = () => {
  const [enabled, setEnabled] = useSetting('inspection.cdpEnabled');
  const settingsReady = useSettingsReady();
  const shortcutLabel = useChordLabel('keyboard.toggleDebugMode');
  const available = hasCapability('cdpInspection');

  if (!available && getCurrentHost() !== 'extension') return null;
  return (
    <DebugModeSwitch
      available={available}
      on={enabled}
      pending={!settingsReady}
      onChange={setEnabled}
      shortcutLabel={shortcutLabel}
    />
  );
};
