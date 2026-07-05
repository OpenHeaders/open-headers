/**
 * Persisted orientation for the rule editor's actions/conditions
 * split — `'vertical'` stacked (default: conditions read better full-
 * width under the actions), `'horizontal'` side-by-side. Same shared
 * mechanism as the request editor's request/response split.
 */

import { createSplitLayoutPreference, type SplitLayout } from '@openheaders/ui/shared/split-layout';

export type RuleEditorLayout = SplitLayout;

export const useRuleEditorLayout = createSplitLayoutPreference('oh.rule-editor.layout', 'vertical');
