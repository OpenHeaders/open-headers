/**
 * Concepts: Limitations.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LimitationsOverviewDiagram } from '../../diagrams';
import { Callout, DiagramFrame, DocParagraph, SurfaceContext } from '../../shared';

export const LimitationsSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>{t('workbench.docs.body.limitations.intro')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.limitations.overviewCaption')}>
        <LimitationsOverviewDiagram />
      </DiagramFrame>
      <Callout kind="limitation" title={t('workbench.docs.body.limitations.devtoolsTitle')}>
        {t('workbench.docs.body.limitations.devtoolsBody')}
      </Callout>
      <Callout kind="limitation" title={t('workbench.docs.body.limitations.scriptTitle')}>
        {t('workbench.docs.body.limitations.scriptPrefix')} <code>fetch()</code>{' '}
        {t('workbench.docs.body.limitations.scriptAnd')} <code>XMLHttpRequest</code>
        {t('workbench.docs.body.limitations.scriptMiddle')} <em>{t('workbench.docs.body.limitations.executionRef')}</em>
        {t('workbench.docs.body.limitations.scriptSuffix')}
      </Callout>
      <Callout kind="limitation" title={t('workbench.docs.body.limitations.mergeTitle')}>
        {t('workbench.docs.body.limitations.mergeBody')}
      </Callout>
      <Callout kind="limitation" title={t('workbench.docs.body.limitations.chromeTitle')}>
        {t('workbench.docs.body.limitations.chromeBody')}
      </Callout>
    </>
  );
};
