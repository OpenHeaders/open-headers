/**
 * use-console-font — the Console tab's face follows the Terminal
 * settings (family preset + size), so one settings page governs every
 * monospace feed in the shell. Each key subscribes on its own, so a
 * size change never re-resolves the family.
 */

import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { resolveFontFamily } from '@openheaders/ui/workbench/settings/schema/editor';

export interface ConsoleFont {
  family: string;
  size: number;
}

export function useConsoleFont(): ConsoleFont {
  const preset = useSettingValue('terminal.fontFamilyPreset');
  const size = useSettingValue('terminal.fontSize');
  return { family: resolveFontFamily(preset), size };
}
