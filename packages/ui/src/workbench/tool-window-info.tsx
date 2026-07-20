/**
 * Single source of truth for the `(i)` title-bar popover copy of every
 * workbench tool window. Keyed by `ToolWindowId`, so the `Record` is
 * exhaustive by construction — add a tool window and the compiler
 * forces its info entry here. Edit a panel's design/text in one place
 * instead of chasing its render site.
 *
 * The shell (`App.tsx`) resolves copy via `getToolWindowInfo(id, t)`
 * and threads it into the panel's `PanelHeader`. Copy resolves at call
 * time through the supplied translator; `{{name}}` / `{{live.*}}`
 * reference syntax composes raw in JSX between the keyed fragments.
 * The Notifications entry comes from the shared notifications family
 * (`getNotificationsPanelInfo`) so every surface's registry describes
 * the panel identically.
 */

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { getNotificationsPanelInfo } from '@openheaders/ui/shared/notifications';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { buildRuleIcon } from './components/shared/rule-icon';
import { scopeBadge } from './components/shared/scope-colors';
import { ALL_RULE_TYPES } from './rule-type-menu';
import type { ToolWindowId } from './types';

/** Inline `{{token}}` reference — code chip so the syntax reads as
 *  syntax, matching the per-scope popovers' treatment. */
const Code = ({ children }: { children: string }) => (
  <code
    style={{
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      fontSize: 11,
      padding: '0 4px',
      borderRadius: 3,
      background: 'var(--ant-color-fill-tertiary)',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </code>
);

function buildToolWindowInfo(t: Translate): Record<ToolWindowId, InfoPopoverContent> {
  return {
    'http-rules': {
      title: t('workbench.toolWindows.httpRules'),
      summary: t('workbench.toolWindows.info.httpRules.summary'),
      sections: [
        {
          heading: t('workbench.toolWindows.info.httpRules.ruleTypesHeading'),
          // Single-sourced from the create-menu catalogue so the popover
          // never drifts from what the picker actually offers. The lead
          // icon is the same fixed-width type code rows render, so the
          // labels form an aligned column. Stacked layout: these labels
          // are long, so descriptions get their own line.
          layout: 'stacked',
          items: ALL_RULE_TYPES.map((rt) => ({
            icon: buildRuleIcon({ ruleType: rt.key, isActive: true }),
            label: t(rt.labelKey),
            desc: t(rt.descriptionKey),
          })),
        },
      ],
    },
    workflows: {
      title: t('workbench.toolWindows.workflows'),
      summary: (
        <>
          {t('workbench.toolWindows.info.workflows.summaryPrefix')} <Code>{'{{live.*}}'}</Code>{' '}
          {t('workbench.toolWindows.info.workflows.summarySuffix')}
        </>
      ),
    },
    docs: {
      title: t('workbench.toolWindows.docs'),
      summary: t('workbench.toolWindows.info.docs.summary'),
    },
    'var-scope': {
      title: t('workbench.toolWindows.varScope'),
      summary: (
        <>
          {t('workbench.toolWindows.info.varScope.summaryPrefix')} <Code>{'{{name}}'}</Code>{' '}
          {t('workbench.toolWindows.info.varScope.summaryMiddle')} <Code>{'{{live.*}}'}</Code>{' '}
          {t('workbench.toolWindows.info.varScope.summarySuffix')}
        </>
      ),
      sections: [
        {
          heading: t('workbench.toolWindows.info.varScope.priorityHeading'),
          items: [
            {
              icon: scopeBadge('vault', 14),
              label: t('workbench.toolWindows.info.varScope.vaultLabel'),
              desc: t('workbench.toolWindows.info.varScope.vaultDesc'),
            },
            {
              icon: scopeBadge('environment', 14),
              label: t('workbench.toolWindows.info.varScope.environmentLabel'),
              desc: t('workbench.toolWindows.info.varScope.environmentDesc'),
            },
            {
              icon: scopeBadge('collection', 14),
              label: t('workbench.toolWindows.info.varScope.collectionLabel'),
              desc: t('workbench.toolWindows.info.varScope.collectionDesc'),
            },
            {
              icon: scopeBadge('workspace', 14),
              label: t('workbench.toolWindows.info.varScope.workspaceLabel'),
              desc: t('workbench.toolWindows.info.varScope.workspaceDesc'),
            },
          ],
        },
        {
          heading: t('workbench.toolWindows.info.varScope.namespacedHeading'),
          items: [
            {
              icon: scopeBadge('live', 14),
              label: t('workbench.toolWindows.info.varScope.liveLabel'),
              desc: (
                <>
                  {t('workbench.toolWindows.info.varScope.liveDescPrefix')} <Code>{'{{live.*}}'}</Code>
                  {t('workbench.toolWindows.info.varScope.liveDescSuffix')}
                </>
              ),
            },
          ],
        },
      ],
    },
    variables: {
      title: t('workbench.toolWindows.variables'),
      summary: t('workbench.toolWindows.info.variables.summary'),
      sections: [
        {
          heading: t('workbench.toolWindows.info.variables.typesHeading'),
          items: [
            {
              icon: scopeBadge('vault', 14),
              label: t('workbench.toolWindows.info.varScope.vaultLabel'),
              desc: t('workbench.toolWindows.info.variables.vaultDesc'),
            },
            {
              icon: scopeBadge('environment', 14),
              label: t('workbench.toolWindows.info.varScope.environmentLabel'),
              desc: t('workbench.toolWindows.info.variables.environmentDesc'),
            },
            {
              icon: scopeBadge('collection', 14),
              label: t('workbench.toolWindows.info.varScope.collectionLabel'),
              desc: t('workbench.toolWindows.info.variables.collectionDesc'),
            },
            {
              icon: scopeBadge('workspace', 14),
              label: t('workbench.toolWindows.info.varScope.workspaceLabel'),
              desc: t('workbench.toolWindows.info.variables.workspaceDesc'),
            },
            {
              icon: scopeBadge('live', 14),
              label: t('workbench.toolWindows.info.varScope.liveLabel'),
              desc: (
                <>
                  {t('workbench.toolWindows.info.variables.liveDescPrefix')} <Code>{'{{live.*}}'}</Code>
                  {t('workbench.toolWindows.info.variables.liveDescSuffix')}
                </>
              ),
            },
          ],
        },
      ],
    },
    'api-requests': {
      title: t('workbench.toolWindows.apiRequests'),
      summary: t('workbench.toolWindows.info.apiRequests.summary'),
      sections: [
        {
          heading: t('workbench.toolWindows.info.apiRequests.editorHeading'),
          // Mirrors the editor's tab strip so the popover is a map of the
          // surface, not generic HTTP trivia. Sub-type lists match the
          // actual pickers (AuthorizationTab, BodyTab, ScriptsTab).
          layout: 'stacked',
          items: [
            {
              label: t('workbench.toolWindows.info.apiRequests.docsLabel'),
              desc: t('workbench.toolWindows.info.apiRequests.docsDesc'),
            },
            {
              label: t('workbench.toolWindows.info.apiRequests.paramsLabel'),
              desc: t('workbench.toolWindows.info.apiRequests.paramsDesc'),
            },
            {
              label: t('workbench.toolWindows.info.apiRequests.authorizationLabel'),
              desc: t('workbench.toolWindows.info.apiRequests.authorizationDesc'),
            },
            {
              label: t('workbench.toolWindows.info.apiRequests.headersLabel'),
              desc: t('workbench.toolWindows.info.apiRequests.headersDesc'),
            },
            {
              label: t('workbench.toolWindows.info.apiRequests.bodyLabel'),
              desc: t('workbench.toolWindows.info.apiRequests.bodyDesc'),
            },
            {
              label: t('workbench.toolWindows.info.apiRequests.scriptsLabel'),
              desc: t('workbench.toolWindows.info.apiRequests.scriptsDesc'),
            },
            {
              label: t('workbench.toolWindows.info.apiRequests.settingsLabel'),
              desc: t('workbench.toolWindows.info.apiRequests.settingsDesc'),
            },
          ],
        },
      ],
    },
    'proxy-capture': {
      title: t('workbench.toolWindows.proxyCapture'),
      summary: t('workbench.toolWindows.info.proxyCapture.summary'),
    },
    'live-network': {
      title: t('workbench.toolWindows.liveNetwork'),
      summary: t('workbench.toolWindows.info.liveNetwork.summary'),
    },
    'workflow-status': {
      title: t('workbench.toolWindows.workflowStatus'),
      summary: t('workbench.toolWindows.info.workflowStatus.summary'),
    },
    notifications: getNotificationsPanelInfo(t),
    activity: {
      title: t('workbench.toolWindows.activity'),
      summary: t('workbench.toolWindows.info.activity.summary'),
    },
    terminal: {
      title: t('workbench.toolWindows.terminal'),
      summary: t('workbench.toolWindows.info.terminal.summary'),
    },
    git: {
      title: t('workbench.toolWindows.git'),
      summary: t('workbench.toolWindows.info.git.summary'),
    },
  };
}

/** Title-bar `(i)` popover copy for a workbench tool window. */
export function getToolWindowInfo(id: ToolWindowId, t: Translate): InfoPopoverContent {
  return buildToolWindowInfo(t)[id];
}
