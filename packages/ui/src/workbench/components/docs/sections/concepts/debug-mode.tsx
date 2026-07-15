/**
 * Concepts: Debug mode.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  DebugModeReachDiagram,
  DebugModeScopeDiagram,
  DebugModeStatesDiagram,
  DebugModeSurfaceDiagram,
} from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocLink, DocParagraph, StateRow, SurfaceContext } from '../../shared';

export const DebugModeSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>
        <strong>{t('workbench.docs.body.debugMode.term')}</strong> {t('workbench.docs.body.debugMode.intro1')}{' '}
        <em>{t('workbench.docs.body.debugMode.introBanner')}</em> {t('workbench.docs.body.debugMode.intro1Suffix')}
      </DocParagraph>
      <DocParagraph>{t('workbench.docs.body.debugMode.intro2')}</DocParagraph>

      <DocHeading level={3}>{t('workbench.docs.body.debugMode.controlHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.debugMode.control1Prefix')} <code>● Debug mode</code>{' '}
        {t('workbench.docs.body.debugMode.control1Middle')}{' '}
        <DocLink to="system-status">{t('workbench.docs.body.debugMode.systemStatusLink')}</DocLink>
        {t('workbench.docs.body.debugMode.control1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.debugMode.surfaceCaption')}>
        <DebugModeSurfaceDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.debugMode.scopeHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.debugMode.scope1Prefix')}{' '}
        <strong>{t('workbench.docs.body.debugMode.attachTo')}</strong>{' '}
        {t('workbench.docs.body.debugMode.scope1Middle')}{' '}
        <strong>{t('workbench.docs.body.debugMode.scopeDevtools')}</strong>{' '}
        {t('workbench.docs.body.debugMode.scope1DevtoolsParen')}{' '}
        <strong>{t('workbench.docs.body.debugMode.scopeFocused')}</strong>{' '}
        {t('workbench.docs.body.debugMode.scope1FocusedParen')}{' '}
        <strong>{t('workbench.docs.body.debugMode.scopeBoth')}</strong>{' '}
        {t('workbench.docs.body.debugMode.scope1BothParen')}
      </DocParagraph>
      <DocParagraph>
        {t('workbench.docs.body.debugMode.consent1Prefix')} <em>{t('workbench.docs.body.debugMode.consentIs')}</em>{' '}
        {t('workbench.docs.body.debugMode.consent1Middle')}{' '}
        <strong>{t('workbench.docs.body.debugMode.includeTabPin')}</strong>{' '}
        {t('workbench.docs.body.debugMode.consent1Suffix')}
      </DocParagraph>
      <DocParagraph>
        {t('workbench.docs.body.debugMode.attached1Prefix')}{' '}
        <strong>{t('workbench.docs.body.debugMode.attachedTabs')}</strong>{' '}
        {t('workbench.docs.body.debugMode.attached1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.debugMode.scopeCaption')}>
        <DebugModeScopeDiagram />
      </DiagramFrame>

      <Callout kind="warn" title={t('workbench.docs.body.debugMode.bannerCalloutTitle')}>
        {t('workbench.docs.body.debugMode.banner1Prefix')} <em>{t('workbench.docs.body.debugMode.bannerEvery')}</em>{' '}
        {t('workbench.docs.body.debugMode.banner1Suffix')}
      </Callout>

      <DocHeading level={3}>{t('workbench.docs.body.debugMode.unlocksHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.debugMode.unlocksIntro')}</DocParagraph>
      <DocParagraph>
        <strong>{t('workbench.docs.body.debugMode.anyRequestLead')}</strong>{' '}
        {t('workbench.docs.body.debugMode.anyRequest1')} <code>fetch</code> / <code>XHR</code>
        {t('workbench.docs.body.debugMode.anyRequest2')}
      </DocParagraph>
      <DocParagraph>
        <strong>{t('workbench.docs.body.debugMode.injectionLead')}</strong>{' '}
        {t('workbench.docs.body.debugMode.injection1')}
      </DocParagraph>
      <DocParagraph>
        <strong>{t('workbench.docs.body.debugMode.tabEnvLead')}</strong> {t('workbench.docs.body.debugMode.tabEnv1')}{' '}
        <strong>{t('workbench.docs.body.debugMode.overrides')}</strong> {t('workbench.docs.body.debugMode.tabEnv2')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.debugMode.reachCaption')}>
        <DebugModeReachDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.debugMode.silentHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.debugMode.silent1Prefix')}{' '}
        <strong>{t('workbench.docs.body.debugMode.badgeOff')}</strong>{' '}
        {t('workbench.docs.body.debugMode.silent1Middle')}{' '}
        <strong>{t('workbench.docs.body.debugMode.badgeOutOfScope')}</strong>{' '}
        {t('workbench.docs.body.debugMode.silent1Middle2')} <em>{t('workbench.docs.body.debugMode.silentCan')}</em>{' '}
        {t('workbench.docs.body.debugMode.silent1Suffix')}
      </DocParagraph>

      <DocHeading level={3}>{t('workbench.docs.body.debugMode.colorsHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.debugMode.colors1Prefix')}{' '}
        <DocLink to="system-status">{t('workbench.docs.body.debugMode.systemStatusLink')}</DocLink>{' '}
        <code>Debug mode</code> {t('workbench.docs.body.debugMode.colors1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.debugMode.statesCaption')}>
        <DebugModeStatesDiagram />
      </DiagramFrame>
      <StateRow color="success" label={t('workbench.docs.body.debugMode.stateGreenLabel')}>
        <strong>{t('workbench.docs.body.debugMode.stateOn')}</strong>{' '}
        {t('workbench.docs.body.debugMode.stateOnRest')}
      </StateRow>
      <StateRow color="warning" label={t('workbench.docs.body.debugMode.stateYellowLabel')}>
        {t('workbench.docs.body.debugMode.stateYellowPrefix')}{' '}
        <strong>{t('workbench.docs.body.debugMode.stateYellowTerm')}</strong>{' '}
        {t('workbench.docs.body.debugMode.stateYellowSuffix')}
      </StateRow>
      <StateRow color="error" label={t('workbench.docs.body.debugMode.stateRedLabel')}>
        {t('workbench.docs.body.debugMode.stateRedPrefix')}{' '}
        <strong>{t('workbench.docs.body.debugMode.stateRedTerm')}</strong>{' '}
        {t('workbench.docs.body.debugMode.stateRedSuffix')}
      </StateRow>

      <Callout kind="note" title={t('workbench.docs.body.debugMode.chromiumTitle')}>
        {t('workbench.docs.body.debugMode.chromium1')}
      </Callout>
    </>
  );
};
