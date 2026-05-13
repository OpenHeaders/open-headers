/**
 * Docs sections — split by registry group.
 *
 * One file per group keeps related sections together while staying
 * small enough to navigate. This barrel re-exports everything so
 * `registry.tsx` (and anything else upstream) can keep importing
 * `from './sections'` unchanged.
 */

export {
  ActionsSection,
  BlockSection,
  BodySection,
  DelaySection,
  HeaderActionsSection,
  InjectSection,
  MockSection,
  QueryParamSection,
  RedirectSection,
} from './actions';
export {
  ExecutionSection,
  LimitationsSection,
  MultiTabSection,
  RequestTrackingSection,
  SystemStatusSection,
} from './concepts';
export { ConditionsSection } from './conditions';
export { ComparisonSection, ParadigmSection, RoadmapSection } from './open-headers';
export { KeyboardShortcutsSection, ResourceTypesSection } from './reference';
