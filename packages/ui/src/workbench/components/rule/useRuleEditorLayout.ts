/**
 * Persisted orientation for the rule editor's actions/conditions
 * split — `'horizontal'` side-by-side (default, matching the old
 * two-column grid on wide screens), `'vertical'` stacked. Same shared
 * mechanism as the request editor's request/response split.
 */

import { createSplitLayoutPreference, type SplitLayout } from '../../hooks/useSplitLayoutPreference';

export type RuleEditorLayout = SplitLayout;

export const useRuleEditorLayout = createSplitLayoutPreference('oh.rule-editor.layout', 'horizontal');
