/**
 * Concepts: Variables.
 */

import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type ScopeKey, scopeBadge } from '../../../shared/scope-colors';
import {
  VariablesCollectionRefDiagram,
  VariablesConsumersDiagram,
  VariablesCreationMapDiagram,
  VariablesEnvironmentRefDiagram,
  VariablesLiveLifecycleDiagram,
  VariablesLiveRefDiagram,
  VariablesResolutionLadderDiagram,
  VariablesShadowingDiagram,
  VariablesVaultRefDiagram,
  VariablesWorkspaceRefDiagram,
} from '../../diagrams';
import {
  Anchor,
  Callout,
  DiagramFrame,
  DocHeading,
  DocParagraph,
  OnThisPage,
  SurfaceContext,
} from '../../shared';

/** Scope H4 title with the Scope panel's colored letter badge in front,
 *  so the headings carry the same visual identity as the panel rows. */
const ScopeHeadingLabel: React.FC<{ scope: ScopeKey; children: React.ReactNode }> = ({ scope, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    {scopeBadge(scope)}
    {children}
  </span>
);

const VARIABLE_ANCHORS: { id: string; titleKey: MessageKey }[] = [
  { id: 'variables-scopes', titleKey: 'workbench.docs.body.variables.scopesHeading' },
  { id: 'variables-priority', titleKey: 'workbench.docs.body.variables.priorityHeading' },
  { id: 'variables-rules', titleKey: 'workbench.docs.body.variables.rulesHeading' },
  { id: 'variables-requests', titleKey: 'workbench.docs.body.variables.requestsHeading' },
  { id: 'variables-workflows', titleKey: 'workbench.docs.body.variables.workflowsHeading' },
  { id: 'variables-namespaces', titleKey: 'workbench.docs.body.variables.namespacesHeading' },
  { id: 'variables-inspecting', titleKey: 'workbench.docs.body.variables.inspectingHeading' },
];

export const VariablesSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['workbench', 'devtools']} />
      <DocParagraph>
        {t('workbench.docs.body.variables.intro1Prefix')} <code>{'{{name}}'}</code>
        {t('workbench.docs.body.variables.intro1Suffix')}
      </DocParagraph>
      <OnThisPage entries={VARIABLE_ANCHORS.map((a) => ({ id: a.id, title: t(a.titleKey) }))} />
      <DiagramFrame
        caption={
          <>
            {t('workbench.docs.body.variables.ladderCaptionPrefix')} <code>{'{{token}}'}</code>{' '}
            {t('workbench.docs.body.variables.ladderCaptionSuffix')}
          </>
        }
      >
        <VariablesResolutionLadderDiagram />
      </DiagramFrame>

      <Anchor id="variables-scopes">
        <DocHeading level={3}>{t('workbench.docs.body.variables.scopesHeading')}</DocHeading>
      </Anchor>
      <Anchor id="variables-vault">
        <DocHeading level={4}>
          <ScopeHeadingLabel scope="vault">{t('workbench.docs.body.variables.vaultHeading')}</ScopeHeadingLabel>
        </DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.vault1Prefix')} <em>{t('workbench.docs.body.variables.vaultKindString')}</em>{' '}
        {t('workbench.docs.body.variables.vault1Middle')} <em>{t('workbench.docs.body.variables.vaultKindTotp')}</em>{' '}
        {t('workbench.docs.body.variables.vault1Suffix')}
      </DocParagraph>
      <DiagramFrame
        caption={
          <>
            {t('workbench.docs.body.variables.vaultCaptionPrefix')} <code>{'{{vault.*}}'}</code>{' '}
            {t('workbench.docs.body.variables.vaultCaptionSuffix')}
          </>
        }
      >
        <VariablesVaultRefDiagram />
      </DiagramFrame>
      <Anchor id="variables-environment">
        <DocHeading level={4}>
          <ScopeHeadingLabel scope="environment">
            {t('workbench.docs.body.variables.environmentHeading')}
          </ScopeHeadingLabel>
        </DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.environment1Prefix')} <code>staging</code>, <code>production</code>
        {t('workbench.docs.body.variables.environment1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.variables.environmentCaption')}>
        <VariablesEnvironmentRefDiagram />
      </DiagramFrame>
      <Anchor id="variables-collection">
        <DocHeading level={4}>
          <ScopeHeadingLabel scope="collection">
            {t('workbench.docs.body.variables.collectionHeading')}
          </ScopeHeadingLabel>
        </DocHeading>
      </Anchor>
      <DocParagraph>{t('workbench.docs.body.variables.collection1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.variables.collectionCaption')}>
        <VariablesCollectionRefDiagram />
      </DiagramFrame>
      <Anchor id="variables-workspace">
        <DocHeading level={4}>
          <ScopeHeadingLabel scope="workspace">{t('workbench.docs.body.variables.workspaceHeading')}</ScopeHeadingLabel>
        </DocHeading>
      </Anchor>
      <DocParagraph>{t('workbench.docs.body.variables.workspace1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.variables.workspaceCaption')}>
        <VariablesWorkspaceRefDiagram />
      </DiagramFrame>
      <Anchor id="variables-live">
        <DocHeading level={4}>
          <ScopeHeadingLabel scope="live">{t('workbench.docs.body.variables.liveHeading')}</ScopeHeadingLabel>
        </DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.live1Prefix')} <code>{'{{live.name}}'}</code>{' '}
        {t('workbench.docs.body.variables.live1Suffix')}
      </DocParagraph>
      <DiagramFrame
        caption={
          <>
            {t('workbench.docs.body.variables.liveRefCaptionPrefix')} <code>{'{{live.token}}'}</code>{' '}
            {t('workbench.docs.body.variables.liveRefCaptionSuffix')}
          </>
        }
      >
        <VariablesLiveRefDiagram />
      </DiagramFrame>
      <DiagramFrame
        caption={
          <>
            {t('workbench.docs.body.variables.liveLifecycleCaptionPrefix')} <code>{'{{live.token}}'}</code>{' '}
            {t('workbench.docs.body.variables.liveLifecycleCaptionSuffix')}
          </>
        }
      >
        <VariablesLiveLifecycleDiagram />
      </DiagramFrame>

      <Anchor id="variables-priority">
        <DocHeading level={3}>{t('workbench.docs.body.variables.priorityHeading')}</DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.priority1Prefix')} <code>{'{{name}}'}</code>{' '}
        {t('workbench.docs.body.variables.priority1Suffix')}
      </DocParagraph>
      <DiagramFrame
        caption={
          <>
            {t('workbench.docs.body.variables.shadowingCaptionPrefix')} <code>{'{{workspace.api_host}}'}</code>{' '}
            {t('workbench.docs.body.variables.shadowingCaptionSuffix')}
          </>
        }
      >
        <VariablesShadowingDiagram />
      </DiagramFrame>
      <DocParagraph>
        {t('workbench.docs.body.variables.namespacePin1Prefix')} <code>{'{{vault.name}}'}</code>,{' '}
        <code>{'{{env.name}}'}</code>, <code>{'{{collection.name}}'}</code>, <code>{'{{workspace.name}}'}</code>,{' '}
        <code>{'{{live.name}}'}</code>
        {t('workbench.docs.body.variables.namespacePin1Suffix')}
      </DocParagraph>
      <Callout kind="tip" title={t('workbench.docs.body.variables.tipTitle')}>
        {t('workbench.docs.body.variables.tip1Prefix')} <code>{'{{vault.api_key}}'}</code>{' '}
        {t('workbench.docs.body.variables.tip1Suffix')}
      </Callout>

      <Anchor id="variables-rules">
        <DocHeading level={3}>{t('workbench.docs.body.variables.rulesHeading')}</DocHeading>
      </Anchor>
      <DocParagraph>{t('workbench.docs.body.variables.rules1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.variables.consumersCaption')}>
        <VariablesConsumersDiagram />
      </DiagramFrame>
      <Callout kind="note" title={t('workbench.docs.body.variables.dynamicNoteTitle')}>
        {t('workbench.docs.body.variables.dynamicNote1Prefix')}{' '}
        <em>{t('workbench.docs.body.variables.dynamicWord')}</em>{' '}
        {t('workbench.docs.body.variables.dynamicNote1Middle')}{' '}
        <em>{t('workbench.docs.body.variables.staticWord')}</em>{' '}
        {t('workbench.docs.body.variables.dynamicNote1Middle2')} <code>{'{{name}}'}</code>{' '}
        {t('workbench.docs.body.variables.dynamicNote1Suffix')}
      </Callout>

      <Anchor id="variables-requests">
        <DocHeading level={3}>{t('workbench.docs.body.variables.requestsHeading')}</DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.requests1Prefix')} <code>{'{{name}}'}</code>{' '}
        {t('workbench.docs.body.variables.requests1Suffix')}
      </DocParagraph>

      <Anchor id="variables-workflows">
        <DocHeading level={3}>{t('workbench.docs.body.variables.workflowsHeading')}</DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.workflows1Prefix')} <code>{'{{step.<id>.<capture>}}'}</code>{' '}
        {t('workbench.docs.body.variables.workflows1Suffix')}
      </DocParagraph>

      <Anchor id="variables-namespaces">
        <DocHeading level={3}>{t('workbench.docs.body.variables.namespacesHeading')}</DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.helpers1')} <code>{'{{dynamic.*}}'}</code>{' '}
        {t('workbench.docs.body.variables.helpersDynamicMiddle')} <code>{'{{dynamic.uuid}}'}</code>,{' '}
        <code>{'{{dynamic.timestamp}}'}</code>, <code>{'{{dynamic.isoTimestamp}}'}</code>,{' '}
        <code>{'{{dynamic.randomInt}}'}</code>
        {t('workbench.docs.body.variables.helpersFriends')} <code>{'{{file.*}}'}</code>{' '}
        {t('workbench.docs.body.variables.helpersFileMiddle')} <code>{'{{step.*}}'}</code>
        {t('workbench.docs.body.variables.helpersStepSuffix')}
      </DocParagraph>

      <Anchor id="variables-inspecting">
        <DocHeading level={3}>{t('workbench.docs.body.variables.inspectingHeading')}</DocHeading>
      </Anchor>
      <DocParagraph>
        {t('workbench.docs.body.variables.create1Prefix')}{' '}
        <strong>{t('workbench.docs.body.variables.sidebarVault')}</strong>,{' '}
        <strong>{t('workbench.docs.body.variables.sidebarWorkspaceVars')}</strong>
        {t('workbench.docs.body.variables.createAnd')}{' '}
        <strong>{t('workbench.docs.body.variables.sidebarLiveVars')}</strong>{' '}
        {t('workbench.docs.body.variables.create1Middle')}{' '}
        <strong>{t('workbench.docs.body.variables.sidebarEnvironments')}</strong>
        {t('workbench.docs.body.variables.create1Middle2')}{' '}
        <strong>{t('workbench.docs.body.variables.sidebarVariables')}</strong>{' '}
        {t('workbench.docs.body.variables.create1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.variables.creationMapCaption')}>
        <VariablesCreationMapDiagram />
      </DiagramFrame>
      <DocParagraph>
        {t('workbench.docs.body.variables.inspect1Prefix')}{' '}
        <strong>{t('workbench.docs.body.variables.sidebarVariables')}</strong>{' '}
        {t('workbench.docs.body.variables.inspect1Middle')} <em>{t('workbench.docs.body.variables.inScopeLabel')}</em>{' '}
        {t('workbench.docs.body.variables.inspect1Middle2')}{' '}
        <em>{t('workbench.docs.body.variables.allScopesLabel')}</em>{' '}
        {t('workbench.docs.body.variables.inspect1Middle3')} <code>{'{{'}</code>{' '}
        {t('workbench.docs.body.variables.inspect1Suffix')}
      </DocParagraph>
    </>
  );
};
