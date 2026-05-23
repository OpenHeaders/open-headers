/**
 * Background-side bootstrap for view-mode handling. The real logic
 * lives in `background/view-mode/controller.ts`; this file is just the
 * call site `background.ts` uses to start it.
 */

import { getViewModeController } from '@/background/view-mode/controller';

export async function initializeViewMode(): Promise<void> {
  await getViewModeController().initialize();
}
