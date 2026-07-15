import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ComparisonMatrixDiagram,
  ComparisonVsCloudDiagram,
  ComparisonVsHeaderOnlyDiagram,
  ComparisonVsProxyDiagram,
  ParadigmApiCatalogDiagram,
  ParadigmConvergenceDiagram,
  ParadigmFieldSyncDiagram,
  ParadigmFrontEndsDiagram,
  ParadigmLocalFirstDiagram,
  ParadigmRuleEngineDiagram,
  ParadigmShiftDiagram,
  RoadmapCliDiagram,
  RoadmapDaemonDiagram,
  RoadmapDesktopAppDiagram,
  RoadmapGitWorkspacesDiagram,
  RoadmapImportersDiagram,
  RoadmapMcpArchitectureDiagram,
  RoadmapMcpToolsDiagram,
  RoadmapMilestonesDiagram,
  RoadmapWebAppDiagram,
} from '../diagrams';
import { Callout, DiagramFrame, DocHeading, DocLink, DocParagraph } from '../shared';

// ── Open Headers: What do we do (differently) ───────────────────

export const ParadigmSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <DiagramFrame>
        <ParadigmShiftDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.paradigm.oneExtensionHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.paradigm.oneExtension1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.paradigm.convergenceCaption')}>
        <ParadigmConvergenceDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.paradigm.ruleEngineHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.paradigm.ruleEngine1Prefix')}{' '}
        <strong>{t('workbench.docs.body.paradigm.dnrNativeStrong')}</strong>{' '}
        {t('workbench.docs.body.paradigm.ruleEngine1Middle')} <code>declarativeNetRequest</code>
        {t('workbench.docs.body.paradigm.ruleEngine1Middle2')}{' '}
        <strong>{t('workbench.docs.body.paradigm.scriptEngineStrong')}</strong>{' '}
        {t('workbench.docs.body.paradigm.ruleEngine1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.paradigm.ruleEngineCaption')}>
        <ParadigmRuleEngineDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.paradigm.apiCatalogHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.paradigm.apiCatalog1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.paradigm.apiCatalogCaption')}>
        <ParadigmApiCatalogDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.paradigm.localFirstHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.paradigm.localFirst1Prefix')}{' '}
        <em>{t('workbench.docs.body.paradigm.localFirstWhere')}</em>{' '}
        {t('workbench.docs.body.paradigm.localFirst1Suffix')}
      </DocParagraph>
      <DocParagraph>{t('workbench.docs.body.paradigm.localFirst2')}</DocParagraph>
      <DiagramFrame>
        <ParadigmLocalFirstDiagram />
      </DiagramFrame>

      <DocParagraph>
        {t('workbench.docs.body.paradigm.frontEnds1Prefix')} <em>{t('workbench.docs.body.paradigm.frontEndsHow')}</em>{' '}
        {t('workbench.docs.body.paradigm.frontEnds1Suffix')}
      </DocParagraph>
      <DiagramFrame>
        <ParadigmFrontEndsDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.paradigm.autoSyncHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.paradigm.autoSync1Prefix')}{' '}
        <strong>{t('workbench.docs.body.paradigm.perFieldStrong')}</strong>{' '}
        {t('workbench.docs.body.paradigm.autoSync1Middle')} <code>enabled</code>{' '}
        {t('workbench.docs.body.paradigm.autoSync1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.paradigm.fieldSyncCaption')}>
        <ParadigmFieldSyncDiagram />
      </DiagramFrame>

      <Callout kind="note">
        {t('workbench.docs.body.paradigm.noteCalloutPrefix')}{' '}
        <DocLink to="comparison">{t('workbench.docs.body.paradigm.comparisonLink')}</DocLink>{' '}
        {t('workbench.docs.body.paradigm.noteCalloutMiddle')}{' '}
        <DocLink to="roadmap">{t('workbench.docs.body.paradigm.roadmapLink')}</DocLink>
        {t('workbench.docs.body.paradigm.noteCalloutSuffix')}
      </Callout>
    </>
  );
};

// ── Open Headers: The comparison ────────────────────────────────

export const ComparisonSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <DocParagraph>{t('workbench.docs.body.comparison.intro1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.comparison.matrixCaption')}>
        <ComparisonMatrixDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.comparison.vsCloudHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.comparison.vsCloud1')}</DocParagraph>
      <DiagramFrame>
        <ComparisonVsCloudDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.comparison.vsProxiesHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.comparison.vsProxies1Prefix')}{' '}
        <code>declarativeNetRequest</code> {t('workbench.docs.body.comparison.vsProxies1Suffix')}
      </DocParagraph>
      <DiagramFrame>
        <ComparisonVsProxyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.comparison.vsHeaderOnlyHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.comparison.vsHeaderOnly1Prefix')}{' '}
        <DocLink to="header-actions">{t('workbench.docs.body.comparison.nineLink')}</DocLink>{' '}
        {t('workbench.docs.body.comparison.vsHeaderOnly1Middle')}{' '}
        <DocLink to="block">{t('workbench.docs.body.comparison.blockLink')}</DocLink>,{' '}
        <DocLink to="redirect">{t('workbench.docs.body.comparison.redirectLink')}</DocLink>,{' '}
        <DocLink to="query-param">{t('workbench.docs.body.comparison.queryParamsLink')}</DocLink>,{' '}
        <DocLink to="inject">{t('workbench.docs.body.comparison.injectLink')}</DocLink>,{' '}
        <DocLink to="delay">{t('workbench.docs.body.comparison.delayLink')}</DocLink>,{' '}
        <DocLink to="request-body">{t('workbench.docs.body.comparison.requestBodyLink')}</DocLink>,{' '}
        <DocLink to="response">{t('workbench.docs.body.comparison.responseLink')}</DocLink>{' '}
        {t('workbench.docs.body.comparison.vsHeaderOnly1Middle2')}{' '}
        <DocLink to="conditions">{t('workbench.docs.body.comparison.conditionLanguageLink')}</DocLink>
        {t('workbench.docs.body.comparison.vsHeaderOnly1Middle3')}{' '}
        <DocLink to="request-tracking">{t('workbench.docs.body.comparison.requestTrackingLink')}</DocLink>{' '}
        {t('workbench.docs.body.comparison.vsHeaderOnly1Suffix')}
      </DocParagraph>
      <DiagramFrame>
        <ComparisonVsHeaderOnlyDiagram />
      </DiagramFrame>

      <Callout kind="tip" title={t('workbench.docs.body.comparison.whyMattersTitle')}>
        {t('workbench.docs.body.comparison.whyMatters1')}
      </Callout>
    </>
  );
};

// ── Open Headers: The roadmap ───────────────────────────────────

export const RoadmapSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <DocParagraph>
        {t('workbench.docs.body.roadmap.intro1Prefix')}{' '}
        <strong>{t('workbench.docs.body.roadmap.userControlledStrong')}</strong>{' '}
        {t('workbench.docs.body.roadmap.intro1Suffix')}
      </DocParagraph>
      <DiagramFrame>
        <RoadmapMilestonesDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.roadmap.gitHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.roadmap.git1Prefix')}{' '}
        <code>git log</code> {t('workbench.docs.body.roadmap.gitAnd')} <code>git blame</code>{' '}
        {t('workbench.docs.body.roadmap.git1Suffix')}
      </DocParagraph>
      <DiagramFrame>
        <RoadmapGitWorkspacesDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.roadmap.desktopHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.roadmap.desktop1')}</DocParagraph>
      <DiagramFrame>
        <RoadmapDesktopAppDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.roadmap.mcpHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.roadmap.mcp1Prefix')} <strong>{t('workbench.docs.body.roadmap.mcpStrong')}</strong>{' '}
        {t('workbench.docs.body.roadmap.mcp1Suffix')}
      </DocParagraph>
      <DocParagraph>
        {t('workbench.docs.body.roadmap.mcp2Prefix')}{' '}
        <strong>{t('workbench.docs.body.roadmap.mcpLocalOnlyStrong')}</strong>{' '}
        {t('workbench.docs.body.roadmap.mcp2Middle')}{' '}
        <strong>{t('workbench.docs.body.roadmap.mcpRemoteStrong')}</strong>{' '}
        {t('workbench.docs.body.roadmap.mcp2Suffix')}
      </DocParagraph>
      <DiagramFrame>
        <RoadmapMcpArchitectureDiagram />
      </DiagramFrame>
      <DiagramFrame>
        <RoadmapMcpToolsDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.roadmap.daemonHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.roadmap.daemon1')}</DocParagraph>
      <DiagramFrame>
        <RoadmapDaemonDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.roadmap.cliHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.roadmap.cli1')}</DocParagraph>
      <DiagramFrame>
        <RoadmapCliDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.roadmap.webAppHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.roadmap.webApp1')}</DocParagraph>
      <DiagramFrame>
        <RoadmapWebAppDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.roadmap.importersHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.roadmap.importers1')}</DocParagraph>
      <DiagramFrame>
        <RoadmapImportersDiagram />
      </DiagramFrame>

      <Callout kind="note" title={t('workbench.docs.body.roadmap.cloudCalloutTitle')}>
        {t('workbench.docs.body.roadmap.cloudCallout1')}
      </Callout>
    </>
  );
};
