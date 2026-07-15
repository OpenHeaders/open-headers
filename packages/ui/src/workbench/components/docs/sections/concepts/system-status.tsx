/**
 * Concepts: System Status.
 */

import { Tag } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  LivePillAggregationDiagram,
  LiveWorkflowFreshnessDiagram,
  PermissionsAuditFlowDiagram,
  PermissionsImpactDiagram,
  RequestExecutorOutcomesDiagram,
  RequestExecutorScopeDiagram,
  RulesCapacityDiagram,
  RulesPipelineDiagram,
  SyncLifecycleDiagram,
  SyncTopologyDiagram,
  SystemStatusPopoverDiagram,
  SystemStatusPopupSurfaceDiagram,
  SystemStatusWorkbenchSurfaceDiagram,
  SystemStatusWorstLevelDiagram,
  VaultDriftDetailDiagram,
  VaultHydrationDiagram,
} from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocParagraph, StateRow, SurfaceContext } from '../../shared';

const SubsystemHeading: React.FC<{ name: string; subtitle: string }> = ({ name, subtitle }) => (
  <DocHeading level={3}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
        {name}
      </Tag>
      <span>{subtitle}</span>
    </span>
  </DocHeading>
);

export const SystemStatusSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>
        <strong>{t('workbench.docs.body.systemStatus.term')}</strong> {t('workbench.docs.body.systemStatus.intro1')}{' '}
        <code>● System status</code> {t('workbench.docs.body.systemStatus.intro1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.workbenchCaption')}>
        <SystemStatusWorkbenchSurfaceDiagram />
      </DiagramFrame>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.popupCaption')}>
        <SystemStatusPopupSurfaceDiagram />
      </DiagramFrame>
      <DocParagraph>{t('workbench.docs.body.systemStatus.worstLevel1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.worstLevelCaption')}>
        <SystemStatusWorstLevelDiagram />
      </DiagramFrame>
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.popover1')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.settingsExportPath')}</strong>
        {t('workbench.docs.body.systemStatus.popover1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.popoverCaption')}>
        <SystemStatusPopoverDiagram />
      </DiagramFrame>

      <SubsystemHeading
        name={t('workbench.docs.body.systemStatus.syncName')}
        subtitle={t('workbench.docs.body.systemStatus.syncSubtitle')}
      />
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.sync1Prefix')}
        <code>127.0.0.1:8137</code>
        {t('workbench.docs.body.systemStatus.sync1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.syncTopologyCaption')}>
        <SyncTopologyDiagram />
      </DiagramFrame>
      <DocParagraph>{t('workbench.docs.body.systemStatus.sync2')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.syncLifecycleCaption')}>
        <SyncLifecycleDiagram />
      </DiagramFrame>
      <StateRow color="success" label={t('workbench.docs.body.systemStatus.stateGreenLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.syncGreenConnected')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.syncGreenMiddle')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.syncGreenDisabled')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.syncGreenSuffix')}
      </StateRow>
      <StateRow color="warning" label={t('workbench.docs.body.systemStatus.stateYellowLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.syncYellowConnecting')}</strong> /{' '}
        <strong>{t('workbench.docs.body.systemStatus.syncYellowReconnecting')}</strong>
        {t('workbench.docs.body.systemStatus.syncYellowOr')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.syncYellowRejected')}</strong>
        {t('workbench.docs.body.systemStatus.syncYellowSuffix')}
      </StateRow>
      <StateRow color="error" label={t('workbench.docs.body.systemStatus.stateRedLabel')}>
        {t('workbench.docs.body.systemStatus.syncRed')}
      </StateRow>

      <SubsystemHeading
        name={t('workbench.docs.body.systemStatus.rulesName')}
        subtitle={t('workbench.docs.body.systemStatus.rulesSubtitle')}
      />
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.rules1Prefix')} <code>{'{{VAR}}'}</code>{' '}
        {t('workbench.docs.body.systemStatus.rules1Middle')}
        <code> declarativeNetRequest</code> {t('workbench.docs.body.systemStatus.rules1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.rulesPipelineCaption')}>
        <RulesPipelineDiagram />
      </DiagramFrame>
      <DocParagraph>{t('workbench.docs.body.systemStatus.rules2')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.rulesCapacityCaption')}>
        <RulesCapacityDiagram />
      </DiagramFrame>
      <StateRow color="success" label={t('workbench.docs.body.systemStatus.stateGreenLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.rulesGreenActive')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.rulesGreenOr')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.rulesGreenPaused')}</strong>
        {t('workbench.docs.body.systemStatus.rulesGreenSuffix')}
      </StateRow>
      <StateRow color="warning" label={t('workbench.docs.body.systemStatus.stateYellowLabel')}>
        {t('workbench.docs.body.systemStatus.rulesYellowPrefix')} <code>{'{{VAR}}'}</code>{' '}
        {t('workbench.docs.body.systemStatus.rulesYellowRefs')}
        <em>{t('workbench.docs.body.systemStatus.rulesYellowMsgUnresolved')}</em>
        {t('workbench.docs.body.systemStatus.rulesYellowMiddle')}
        <em>{t('workbench.docs.body.systemStatus.rulesYellowMsgDropped')}</em>
        {t('workbench.docs.body.systemStatus.rulesYellowMiddle2')}
        <em>{t('workbench.docs.body.systemStatus.rulesYellowMsgCapacity')}</em>
        {t('workbench.docs.body.systemStatus.rulesYellowSuffix')}
      </StateRow>
      <StateRow color="error" label={t('workbench.docs.body.systemStatus.stateRedLabel')}>
        {t('workbench.docs.body.systemStatus.rulesRedPrefix')}
        <em>{t('workbench.docs.body.systemStatus.rulesRedMsg')}</em>
        {t('workbench.docs.body.systemStatus.rulesRedSuffix')}
      </StateRow>

      <SubsystemHeading
        name={t('workbench.docs.body.systemStatus.requestsName')}
        subtitle={t('workbench.docs.body.systemStatus.requestsSubtitle')}
      />
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.requests1Prefix')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.requestsSend')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.requests1Middle')}{' '}
        <em>{t('workbench.docs.body.systemStatus.requestsAny')}</em>{' '}
        {t('workbench.docs.body.systemStatus.requests1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.requestsOutcomesCaption')}>
        <RequestExecutorOutcomesDiagram />
      </DiagramFrame>
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.requests2Prefix')} <code>silentStatus: true</code>
        {t('workbench.docs.body.systemStatus.requests2Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.requestsScopeCaption')}>
        <RequestExecutorScopeDiagram />
      </DiagramFrame>
      <StateRow color="success" label={t('workbench.docs.body.systemStatus.stateGreenLabel')}>
        <strong>
          {t('workbench.docs.body.systemStatus.requestsGreenLabel')} {'<status> <statusText>'}
        </strong>{' '}
        {t('workbench.docs.body.systemStatus.requestsGreenMiddle')} <em>200 OK</em>, <em>404 Not Found</em>,{' '}
        <em>500 Server Error</em>
        {t('workbench.docs.body.systemStatus.requestsGreenSuffix')}
      </StateRow>
      <StateRow color="warning" label={t('workbench.docs.body.systemStatus.stateYellowLabel')}>
        <strong>
          {t('workbench.docs.body.systemStatus.requestsYellowLabel')} {'<message>'}
        </strong>{' '}
        {t('workbench.docs.body.systemStatus.requestsYellowMiddle')} <em>NetworkError</em>, <em>Aborted</em>
        {t('workbench.docs.body.systemStatus.requestsYellowSuffix')}
      </StateRow>

      <SubsystemHeading
        name={t('workbench.docs.body.systemStatus.permissionsName')}
        subtitle={t('workbench.docs.body.systemStatus.permissionsSubtitle')}
      />
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.permissions1Prefix')} <code>chrome://extensions</code>{' '}
        {t('workbench.docs.body.systemStatus.permissions1Middle')}{' '}
        <em>{t('workbench.docs.body.systemStatus.permissionsLooks')}</em>{' '}
        {t('workbench.docs.body.systemStatus.permissions1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.permissionsImpactCaption')}>
        <PermissionsImpactDiagram />
      </DiagramFrame>
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.permissions2Prefix')}{' '}
        <code>chrome.permissions.contains({"{ origins: ['<all_urls>'] }"})</code>{' '}
        {t('workbench.docs.body.systemStatus.permissions2Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.permissionsAuditCaption')}>
        <PermissionsAuditFlowDiagram />
      </DiagramFrame>
      <StateRow color="success" label={t('workbench.docs.body.systemStatus.stateGreenLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.permissionsGreenLabel')}</strong> —{' '}
        <code>&lt;all_urls&gt;</code> {t('workbench.docs.body.systemStatus.permissionsGreenSuffix')}
      </StateRow>
      <StateRow color="warning" label={t('workbench.docs.body.systemStatus.stateYellowLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.permissionsYellowLabel')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.permissionsYellowMiddle')} <code>chrome.permissions</code>
        {t('workbench.docs.body.systemStatus.permissionsYellowSuffix')}
      </StateRow>
      <StateRow color="error" label={t('workbench.docs.body.systemStatus.stateRedLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.permissionsRedLabel')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.permissionsRedMiddle')} <code>chrome://extensions</code>
        {t('workbench.docs.body.systemStatus.permissionsRedSuffix')}
      </StateRow>

      <SubsystemHeading
        name={t('workbench.docs.body.systemStatus.secretsName')}
        subtitle={t('workbench.docs.body.systemStatus.secretsSubtitle')}
      />
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.secrets1Prefix')} <code>chrome.storage.local</code>
        {t('workbench.docs.body.systemStatus.secrets1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.vaultHydrationCaption')}>
        <VaultHydrationDiagram />
      </DiagramFrame>
      <DocParagraph>{t('workbench.docs.body.systemStatus.secrets2')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.vaultDriftCaption')}>
        <VaultDriftDetailDiagram />
      </DiagramFrame>
      <StateRow color="success" label={t('workbench.docs.body.systemStatus.stateGreenLabel')}>
        {t('workbench.docs.body.systemStatus.secretsGreen')}
      </StateRow>
      <StateRow color="warning" label={t('workbench.docs.body.systemStatus.stateYellowLabel')}>
        <strong>
          {t('workbench.docs.body.systemStatus.secretsYellowLabel')} {'<storageKey>'}
        </strong>{' '}
        {t('workbench.docs.body.systemStatus.secretsYellowMiddle')}
      </StateRow>
      <StateRow color="error" label={t('workbench.docs.body.systemStatus.stateRedLabel')}>
        {t('workbench.docs.body.systemStatus.secretsRed')}
      </StateRow>

      <SubsystemHeading
        name={t('workbench.docs.body.systemStatus.liveName')}
        subtitle={t('workbench.docs.body.systemStatus.liveSubtitle')}
      />
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.live1Prefix')} <code>2×</code>{' '}
        {t('workbench.docs.body.systemStatus.live1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.liveFreshnessCaption')}>
        <LiveWorkflowFreshnessDiagram />
      </DiagramFrame>
      <DocParagraph>
        {t('workbench.docs.body.systemStatus.live2Prefix')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.liveActiveWorkspace')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.live2Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.systemStatus.liveAggregationCaption')}>
        <LivePillAggregationDiagram />
      </DiagramFrame>
      <StateRow color="success" label={t('workbench.docs.body.systemStatus.stateGreenLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.liveGreenLabel')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.liveGreenMiddle')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.liveGreenNone')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.liveGreenSuffix')}
      </StateRow>
      <StateRow color="warning" label={t('workbench.docs.body.systemStatus.stateYellowLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.liveYellowLabel')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.liveYellowMiddle')}
      </StateRow>
      <StateRow color="error" label={t('workbench.docs.body.systemStatus.stateRedLabel')}>
        <strong>{t('workbench.docs.body.systemStatus.liveRedLabel')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.liveRedMiddle')}
      </StateRow>

      <Callout kind="note" title={t('workbench.docs.body.systemStatus.desktopNoteTitle')}>
        {t('workbench.docs.body.systemStatus.desktopNote1')}{' '}
        <strong>{t('workbench.docs.body.systemStatus.syncName')}</strong>{' '}
        {t('workbench.docs.body.systemStatus.desktopNote2')}
      </Callout>
    </>
  );
};
