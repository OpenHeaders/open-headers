/**
 * Concepts: Request Tracking.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  DirectVsIndirectDiagram,
  RequestTrackingDiagram,
  RequestTrackingPhasesDiagram,
  RequestTrackingUiDiagram,
} from '../../diagrams';
import { DiagramFrame, DocHeading, DocLink, DocParagraph, SurfaceContext } from '../../shared';

export const RequestTrackingSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel']} />
      <DocParagraph>
        {t('workbench.docs.body.requestTracking.intro1Prefix')}{' '}
        <strong>{t('workbench.docs.body.requestTracking.thisPage')}</strong>{' '}
        {t('workbench.docs.body.requestTracking.intro1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.requestTracking.phasesCaption')}>
        <RequestTrackingPhasesDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.requestTracking.howHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.requestTracking.how1Prefix')} <code>webRequest</code>{' '}
        {t('workbench.docs.body.requestTracking.how1Middle')}{' '}
        <strong>{t('workbench.docs.body.requestTracking.thisPage')}</strong>{' '}
        {t('workbench.docs.body.requestTracking.how1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.requestTracking.howCaption')}>
        <RequestTrackingDiagram />
      </DiagramFrame>
      <DocParagraph>{t('workbench.docs.body.requestTracking.badge1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.requestTracking.badgeCaption')}>
        <RequestTrackingUiDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.requestTracking.directHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.requestTracking.direct1Prefix')}{' '}
        <strong>{t('workbench.docs.body.requestTracking.directTerm')}</strong>{' '}
        {t('workbench.docs.body.requestTracking.direct1Middle')}{' '}
        <strong>{t('workbench.docs.body.requestTracking.indirectTerm')}</strong>{' '}
        {t('workbench.docs.body.requestTracking.direct1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.requestTracking.directCaption')}>
        <DirectVsIndirectDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.requestTracking.typesHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.requestTracking.types1Prefix')} <code>ResourceType</code>{' '}
        {t('workbench.docs.body.requestTracking.types1Middle')}{' '}
        <DocLink to="resource-types">{t('workbench.docs.body.requestTracking.resourceTypesLink')}</DocLink>{' '}
        {t('workbench.docs.body.requestTracking.types1Suffix')}
      </DocParagraph>
    </>
  );
};
