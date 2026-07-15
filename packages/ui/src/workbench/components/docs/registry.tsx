/**
 * Section registry — single source of truth for the Docs panel's
 * navigator (TOC list + breadcrumb).
 *
 * Each entry maps a stable `id` (used by `openDocs(id)` deep links)
 * to the human-readable title, owning group, the icon shown next to
 * the row in the TOC, and the component that renders the section's
 * content.
 *
 * The order in `DOC_GROUPS` decides:
 *   • The order groups appear in the TOC list.
 *   • The order of "previous / next" navigation between sections.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  BugOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  FilterOutlined,
  ForwardOutlined,
  FunctionOutlined,
  LinkOutlined,
  ProfileOutlined,
  RadarChartOutlined,
  RocketOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { KeyboardIcon } from '@openheaders/ui/shared/icons';
import {
  buildSectionIndex,
  type DocGroup,
  type DocSection,
  flattenGroups,
} from '@openheaders/ui/shared/docs/registry';
import {
  ActionsSection,
  BlockSection,
  ComparisonSection,
  ConditionsSection,
  DebugModeSection,
  DelaySection,
  ExecutionSection,
  HeaderActionsSection,
  InjectSection,
  KeyboardShortcutsSection,
  LimitationsSection,
  ResponseSection,
  MultiTabSection,
  ParadigmSection,
  QueryParamSection,
  RedirectSection,
  RequestBodySection,
  RequestTrackingSection,
  ResourceTypesSection,
  RoadmapSection,
  SystemStatusSection,
  VariablesSection,
} from './sections';

export type { DocGroup, DocSection };

export const DOC_GROUPS: DocGroup[] = [
  {
    id: 'open-headers',
    labelKey: 'workbench.docs.nav.group.openHeaders',
    sections: [
      {
        id: 'paradigm',
        titleKey: 'workbench.docs.nav.paradigm.title',
        summaryKey: 'workbench.docs.nav.paradigm.summary',
        group: 'open-headers',
        icon: <BulbOutlined />,
        Component: ParadigmSection,
      },
      {
        id: 'comparison',
        titleKey: 'workbench.docs.nav.comparison.title',
        summaryKey: 'workbench.docs.nav.comparison.summary',
        group: 'open-headers',
        icon: <SwapOutlined />,
        Component: ComparisonSection,
      },
      {
        id: 'roadmap',
        titleKey: 'workbench.docs.nav.roadmap.title',
        summaryKey: 'workbench.docs.nav.roadmap.summary',
        group: 'open-headers',
        icon: <RocketOutlined />,
        Component: RoadmapSection,
      },
    ],
  },
  {
    id: 'concepts',
    labelKey: 'workbench.docs.nav.group.concepts',
    sections: [
      {
        id: 'conditions',
        titleKey: 'workbench.docs.nav.conditions.title',
        summaryKey: 'workbench.docs.nav.conditions.summary',
        group: 'concepts',
        icon: <FilterOutlined />,
        Component: ConditionsSection,
      },
      {
        id: 'actions',
        titleKey: 'workbench.docs.nav.actions.title',
        summaryKey: 'workbench.docs.nav.actions.summary',
        group: 'concepts',
        icon: <ThunderboltOutlined />,
        Component: ActionsSection,
      },
      {
        id: 'variables',
        titleKey: 'workbench.docs.nav.variables.title',
        summaryKey: 'workbench.docs.nav.variables.summary',
        group: 'concepts',
        icon: <FunctionOutlined />,
        Component: VariablesSection,
      },
      {
        id: 'request-tracking',
        titleKey: 'workbench.docs.nav.requestTracking.title',
        summaryKey: 'workbench.docs.nav.requestTracking.summary',
        group: 'concepts',
        icon: <RadarChartOutlined />,
        Component: RequestTrackingSection,
      },
      {
        id: 'execution',
        titleKey: 'workbench.docs.nav.execution.title',
        summaryKey: 'workbench.docs.nav.execution.summary',
        group: 'concepts',
        icon: <DeploymentUnitOutlined />,
        Component: ExecutionSection,
      },
      {
        id: 'multi-tab',
        titleKey: 'workbench.docs.nav.multiTab.title',
        summaryKey: 'workbench.docs.nav.multiTab.summary',
        group: 'concepts',
        icon: <AppstoreOutlined />,
        Component: MultiTabSection,
      },
      {
        id: 'system-status',
        titleKey: 'workbench.docs.nav.systemStatus.title',
        summaryKey: 'workbench.docs.nav.systemStatus.summary',
        group: 'concepts',
        icon: <DashboardOutlined />,
        Component: SystemStatusSection,
      },
      {
        id: 'debug-mode',
        titleKey: 'workbench.docs.nav.debugMode.title',
        summaryKey: 'workbench.docs.nav.debugMode.summary',
        group: 'concepts',
        icon: <BugOutlined />,
        Component: DebugModeSection,
      },
    ],
  },
  {
    id: 'modify-requests',
    labelKey: 'workbench.docs.nav.group.modifyRequests',
    sections: [
      {
        id: 'header-actions',
        titleKey: 'workbench.docs.nav.headerActions.title',
        summaryKey: 'workbench.docs.nav.headerActions.summary',
        group: 'modify-requests',
        icon: <ProfileOutlined />,
        Component: HeaderActionsSection,
      },
      {
        id: 'block',
        titleKey: 'workbench.docs.nav.block.title',
        summaryKey: 'workbench.docs.nav.block.summary',
        group: 'modify-requests',
        icon: <StopOutlined />,
        Component: BlockSection,
      },
      {
        id: 'redirect',
        titleKey: 'workbench.docs.nav.redirect.title',
        summaryKey: 'workbench.docs.nav.redirect.summary',
        group: 'modify-requests',
        icon: <ForwardOutlined />,
        Component: RedirectSection,
      },
      {
        id: 'query-param',
        titleKey: 'workbench.docs.nav.queryParam.title',
        summaryKey: 'workbench.docs.nav.queryParam.summary',
        group: 'modify-requests',
        icon: <LinkOutlined />,
        Component: QueryParamSection,
      },
      {
        id: 'request-body',
        titleKey: 'workbench.docs.nav.requestBody.title',
        summaryKey: 'workbench.docs.nav.requestBody.summary',
        group: 'modify-requests',
        icon: <SendOutlined />,
        Component: RequestBodySection,
      },
    ],
  },
  {
    id: 'modify-responses',
    labelKey: 'workbench.docs.nav.group.modifyResponses',
    sections: [
      {
        id: 'response',
        titleKey: 'workbench.docs.nav.response.title',
        summaryKey: 'workbench.docs.nav.response.summary',
        group: 'modify-responses',
        icon: <ApiOutlined />,
        Component: ResponseSection,
      },
    ],
  },
  {
    id: 'run-code',
    labelKey: 'workbench.docs.nav.group.runCode',
    sections: [
      {
        id: 'inject',
        titleKey: 'workbench.docs.nav.inject.title',
        summaryKey: 'workbench.docs.nav.inject.summary',
        group: 'run-code',
        icon: <CodeOutlined />,
        Component: InjectSection,
      },
      {
        id: 'delay',
        titleKey: 'workbench.docs.nav.delay.title',
        summaryKey: 'workbench.docs.nav.delay.summary',
        group: 'run-code',
        icon: <ClockCircleOutlined />,
        Component: DelaySection,
      },
    ],
  },
  {
    id: 'reference',
    labelKey: 'workbench.docs.nav.group.reference',
    sections: [
      {
        id: 'resource-types',
        titleKey: 'workbench.docs.nav.resourceTypes.title',
        summaryKey: 'workbench.docs.nav.resourceTypes.summary',
        group: 'reference',
        icon: <TagsOutlined />,
        Component: ResourceTypesSection,
      },
      {
        id: 'keyboard-shortcuts',
        titleKey: 'workbench.docs.nav.keyboardShortcuts.title',
        summaryKey: 'workbench.docs.nav.keyboardShortcuts.summary',
        group: 'reference',
        icon: <KeyboardIcon />,
        Component: KeyboardShortcutsSection,
      },
      {
        id: 'limitations',
        titleKey: 'workbench.docs.nav.limitations.title',
        summaryKey: 'workbench.docs.nav.limitations.summary',
        group: 'reference',
        icon: <WarningOutlined />,
        Component: LimitationsSection,
      },
    ],
  },
];

const SECTION_BY_ID = buildSectionIndex(DOC_GROUPS);

export const FLAT_SECTIONS = flattenGroups(DOC_GROUPS);

export function findSection(id: string): DocSection | null {
  return SECTION_BY_ID.get(id) ?? null;
}

/** Default section opened on first mount when no deep-link is pending. */
export const DEFAULT_SECTION_ID = 'paradigm';
