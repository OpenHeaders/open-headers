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
  ClockCircleOutlined,
  CodeOutlined,
  CompassOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  FilterOutlined,
  ForwardOutlined,
  KeyOutlined,
  LinkOutlined,
  ProfileOutlined,
  RadarChartOutlined,
  SendOutlined,
  StopOutlined,
  TagsOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type React from 'react';
import {
  BlockSection,
  BodySection,
  ConditionsSection,
  DelaySection,
  ExecutionSection,
  HeaderActionsSection,
  InjectSection,
  KeyboardShortcutsSection,
  LimitationsSection,
  MockSection,
  MultiTabSection,
  QueryParamSection,
  RedirectSection,
  RequestTrackingSection,
  ResourceTypesSection,
  SystemStatusSection,
  WhySection,
} from './sections';

export interface DocSection {
  id: string;
  title: string;
  /**
   * One-line orientation, written for a reader who has never opened
   * this section. Surfaces as a subtitle under each TOC row and as
   * additional text the filter matches against.
   */
  summary: string;
  group: string;
  icon: React.ReactNode;
  Component: React.FC;
}

export interface DocGroup {
  id: string;
  label: string;
  sections: DocSection[];
}

export const DOC_GROUPS: DocGroup[] = [
  {
    id: 'concepts',
    label: 'Concepts',
    sections: [
      {
        id: 'why',
        title: 'Why OpenHeaders',
        summary: 'What problem it solves, where it fits, and why pick it over alternatives.',
        group: 'concepts',
        icon: <CompassOutlined />,
        Component: WhySection,
      },
      {
        id: 'conditions',
        title: 'Conditions',
        summary: 'AND-matching filters that gate every rule — domains, URL patterns, methods, headers.',
        group: 'concepts',
        icon: <FilterOutlined />,
        Component: ConditionsSection,
      },
      {
        id: 'request-tracking',
        title: 'Request Tracking',
        summary: 'How matched requests are observed, recorded, and surfaced as badges in the popup.',
        group: 'concepts',
        icon: <RadarChartOutlined />,
        Component: RequestTrackingSection,
      },
      {
        id: 'execution',
        title: 'How rules execute',
        summary: 'The two engines (DNR and script-based) that decide where each rule applies.',
        group: 'concepts',
        icon: <DeploymentUnitOutlined />,
        Component: ExecutionSection,
      },
      {
        id: 'multi-tab',
        title: 'Multi-tab Behavior',
        summary: 'What syncs across workspace tabs (data) and what stays per-tab (layout, drafts).',
        group: 'concepts',
        icon: <AppstoreOutlined />,
        Component: MultiTabSection,
      },
      {
        id: 'system-status',
        title: 'System Status',
        summary: 'The traffic-light pill — what each subsystem reports and what red / yellow / green mean.',
        group: 'concepts',
        icon: <DashboardOutlined />,
        Component: SystemStatusSection,
      },
    ],
  },
  {
    id: 'modify-requests',
    label: 'Modify Requests',
    sections: [
      {
        id: 'header-actions',
        title: 'Header Actions',
        summary: 'Add, replace, append, remove, or merge request and response headers.',
        group: 'modify-requests',
        icon: <ProfileOutlined />,
        Component: HeaderActionsSection,
      },
      {
        id: 'block',
        title: 'Block',
        summary: 'Cancel matching requests at the network layer.',
        group: 'modify-requests',
        icon: <StopOutlined />,
        Component: BlockSection,
      },
      {
        id: 'redirect',
        title: 'Redirect',
        summary: 'Send matching requests to a different URL — static or regex-substituted.',
        group: 'modify-requests',
        icon: <ForwardOutlined />,
        Component: RedirectSection,
      },
      {
        id: 'query-param',
        title: 'Query Params',
        summary: 'Add, replace, or remove URL query parameters before the request leaves.',
        group: 'modify-requests',
        icon: <LinkOutlined />,
        Component: QueryParamSection,
      },
      {
        id: 'body',
        title: 'Request Body',
        summary: 'Override or transform outgoing fetch / XHR bodies — static, dynamic, or GraphQL-filtered.',
        group: 'modify-requests',
        icon: <SendOutlined />,
        Component: BodySection,
      },
    ],
  },
  {
    id: 'modify-responses',
    label: 'Modify Responses',
    sections: [
      {
        id: 'mock',
        title: 'Response Body + Status',
        summary: 'Intercept API calls and return synthetic or transformed responses — body, status, headers.',
        group: 'modify-responses',
        icon: <ApiOutlined />,
        Component: MockSection,
      },
    ],
  },
  {
    id: 'run-code',
    label: 'Run Code',
    sections: [
      {
        id: 'inject',
        title: 'Inject JS / CSS',
        summary: 'Run JavaScript or CSS in the page context — pre-page-script or after DOM is ready.',
        group: 'run-code',
        icon: <CodeOutlined />,
        Component: InjectSection,
      },
      {
        id: 'delay',
        title: 'Delay',
        summary: 'Add artificial latency to navigations and JS-initiated fetch / XHR.',
        group: 'run-code',
        icon: <ClockCircleOutlined />,
        Component: DelaySection,
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    sections: [
      {
        id: 'resource-types',
        title: 'Resource Types',
        summary: 'Lookup table for the Chrome ResourceType values — Page, Frame, Fetch/XHR, Script, and the rest.',
        group: 'reference',
        icon: <TagsOutlined />,
        Component: ResourceTypesSection,
      },
      {
        id: 'keyboard-shortcuts',
        title: 'Keyboard Shortcuts',
        summary: 'Every workbench shortcut, grouped by surface — panels, tabs, navigation, actions.',
        group: 'reference',
        icon: <KeyOutlined />,
        Component: KeyboardShortcutsSection,
      },
      {
        id: 'limitations',
        title: 'Limitations',
        summary: 'Known surprises in one place — DevTools visibility, script reach, header matching, Merge.',
        group: 'reference',
        icon: <WarningOutlined />,
        Component: LimitationsSection,
      },
    ],
  },
];

const FLAT_SECTIONS: DocSection[] = DOC_GROUPS.flatMap((g) => g.sections);
const SECTION_BY_ID: Map<string, DocSection> = new Map(FLAT_SECTIONS.map((s) => [s.id, s]));

export function findSection(id: string): DocSection | null {
  return SECTION_BY_ID.get(id) ?? null;
}

/** Default section opened on first mount when no deep-link is pending. */
export const DEFAULT_SECTION_ID = 'why';
