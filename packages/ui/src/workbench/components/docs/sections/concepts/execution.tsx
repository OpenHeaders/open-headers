/**
 * Concepts: Execution (DNR vs Script).
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ExecutionDnrReachDiagram, ExecutionScriptReachDiagram, ExecutionStackDiagram } from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocParagraph, EngineTag, SurfaceContext } from '../../shared';

export const ExecutionSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>{t('workbench.docs.body.execution.intro')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.execution.stackCaption')}>
        <ExecutionStackDiagram />
      </DiagramFrame>

      <DocHeading level={3}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <EngineTag kind="dnr" /> {t('workbench.docs.body.execution.dnrHeading')}
        </span>
      </DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.execution.dnr1Prefix')} <code>declarativeNetRequest</code>{' '}
        {t('workbench.docs.body.execution.dnr1Suffix')}
      </DocParagraph>
      <DocParagraph>{t('workbench.docs.body.execution.dnr2')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.execution.dnrCaption')}>
        <ExecutionDnrReachDiagram />
      </DiagramFrame>

      <DocHeading level={3}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <EngineTag kind="script" /> {t('workbench.docs.body.execution.scriptHeading')}
        </span>
      </DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.execution.script1Prefix')} <code>fetch()</code>{' '}
        {t('workbench.docs.body.execution.script1And')} <code>XMLHttpRequest</code>{' '}
        {t('workbench.docs.body.execution.script1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.execution.scriptCaption')}>
        <ExecutionScriptReachDiagram />
      </DiagramFrame>
      <Callout kind="limitation">
        {t('workbench.docs.body.execution.limitPrefix')}
        <code>&lt;img&gt;</code>, <code>&lt;script&gt;</code>, <code>&lt;link&gt;</code>
        {t('workbench.docs.body.execution.limitSuffix')}
      </Callout>
    </>
  );
};
