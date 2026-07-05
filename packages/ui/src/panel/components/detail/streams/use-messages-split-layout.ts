/**
 * Persisted orientation for the Messages tab's frame-grid/payload
 * split — `'vertical'` stacked (default, matching the host's Messages
 * tab), `'horizontal'` side-by-side. Same shared mechanism as the
 * workbench request editor's request/response split.
 */

import { createSplitLayoutPreference } from '@openheaders/ui/shared/split-layout';

export const useMessagesSplitLayout = createSplitLayoutPreference('oh.panel.messages.layout', 'vertical');
