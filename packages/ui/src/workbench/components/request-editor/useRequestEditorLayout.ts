/**
 * Persisted orientation for the API request editor's request/response
 * split — `'horizontal'` side-by-side, `'vertical'` stacked (default).
 * Mechanism (module store + localStorage + lockstep across mounted
 * editors) lives in the shared `createSplitLayoutPreference` factory,
 * which the rule editor's actions/conditions split also uses.
 */

import { createSplitLayoutPreference, type SplitLayout } from '@openheaders/ui/shared/split-layout';

export type RequestEditorLayout = SplitLayout;

export const useRequestEditorLayout = createSplitLayoutPreference('oh.request-editor.layout', 'vertical');
