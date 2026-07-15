/**
 * Concepts: Multi-tab Behavior.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  MultiTabLocalDiagram,
  MultiTabNavigationDiagram,
  MultiTabNumberingDiagram,
  MultiTabSyncDiagram,
  MultiTabSyncedDiagram,
} from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocParagraph, SurfaceContext } from '../../shared';

export const MultiTabSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['workbench', 'devtools']} />
      <DocParagraph>
        {t('workbench.docs.body.multiTab.intro1Prefix')} <code>chrome.storage</code>
        {t('workbench.docs.body.multiTab.intro1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.multiTab.syncCaption')}>
        <MultiTabSyncDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.multiTab.navHeading')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.multiTab.nav1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.multiTab.navCaption')}>
        <MultiTabNavigationDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.multiTab.numberingHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.multiTab.numbering1Prefix')} <code>#1 Open Headers</code>,{' '}
        <code>#2 Open Headers</code>, <code>#3 Open Headers</code>
        {t('workbench.docs.body.multiTab.numbering1Suffix')}
      </DocParagraph>
      <DocParagraph>
        {t('workbench.docs.body.multiTab.numbering2Prefix')} <code>#1</code>{' '}
        {t('workbench.docs.body.multiTab.numbering2While')} <code>#2</code>{' '}
        {t('workbench.docs.body.multiTab.numbering2And')} <code>#3</code>{' '}
        {t('workbench.docs.body.multiTab.numbering2Middle')} <code>#4</code>
        {t('workbench.docs.body.multiTab.numbering2Middle2')} <code>#1</code>{' '}
        {t('workbench.docs.body.multiTab.numbering2Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.multiTab.numberingCaption')}>
        <MultiTabNumberingDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.multiTab.syncsHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.multiTab.syncs1Prefix')} <code>chrome.storage.local</code>{' '}
        {t('workbench.docs.body.multiTab.syncs1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.multiTab.syncedCaption')}>
        <MultiTabSyncedDiagram />
      </DiagramFrame>
      <DiagramFrame caption={t('workbench.docs.body.multiTab.localCaption')}>
        <MultiTabLocalDiagram />
      </DiagramFrame>
      <Callout kind="note" title={t('workbench.docs.body.multiTab.layoutTitle')}>
        {t('workbench.docs.body.multiTab.layout1Prefix')} <em>{t('workbench.docs.body.multiTab.layoutAfter')}</em>{' '}
        {t('workbench.docs.body.multiTab.layout1Suffix')}
      </Callout>
      <Callout kind="warn" title={t('workbench.docs.body.multiTab.draftsTitle')}>
        {t('workbench.docs.body.multiTab.drafts1')}
      </Callout>
    </>
  );
};
