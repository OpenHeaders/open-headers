/**
 * The hour cycle the git surfaces format times with — the workbench
 * clock-format setting's, never the locale's (see log-date). The
 * orchestrators read it and hand it to the pure lists; the details card
 * reads it itself.
 */

import { useSettingValue } from '../../../settings/hooks';
import { type HourCycle, hourCycleFor } from './log-date';

export function useLogHourCycle(): HourCycle {
  return hourCycleFor(useSettingValue('appearance.clockFormat'));
}
