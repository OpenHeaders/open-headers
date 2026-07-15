import { Card, Tag } from 'antd';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ActionsRuleAnatomyDiagram,
  ConditionsHostVsOriginDiagram,
  ConditionsMatchingDiagram,
  DomainTypeDiagram,
  ExcludeDomainsDiagram,
  HeadersConditionDiagram,
  InitiatorDomainsDiagram,
  MethodsDiagram,
  RequestDomainsDiagram,
  ResourceTypesDiagram,
  UrlPatternDiagram,
  UrlRegexDiagram,
} from '../diagrams';
import { Anchor, BrowserTag, DiagramFrame, DocLink, DocParagraph, OnThisPage, SurfaceContext } from '../shared';

// ── Conditions Reference (one section, multiple sub-anchors) ─────

const CONDITION_ANCHORS: { id: string; titleKey: MessageKey }[] = [
  { id: 'url-pattern', titleKey: 'workbench.docs.body.conditions.urlPatternTitle' },
  { id: 'url-regex', titleKey: 'workbench.docs.body.conditions.urlRegexTitle' },
  { id: 'request-domains', titleKey: 'workbench.docs.body.conditions.requestDomainsTitle' },
  { id: 'exclude-domains', titleKey: 'workbench.docs.body.conditions.excludeDomainsTitle' },
  { id: 'initiator-domains', titleKey: 'workbench.docs.body.conditions.initiatorDomainsTitle' },
  { id: 'methods', titleKey: 'workbench.docs.body.conditions.methodsTitle' },
  { id: 'condition-resource-types', titleKey: 'workbench.docs.body.conditions.resourceTypesTitle' },
  { id: 'domain-type', titleKey: 'workbench.docs.body.conditions.domainTypeTitle' },
  { id: 'headers', titleKey: 'workbench.docs.body.conditions.headersTitle' },
];

export const ConditionsSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>
        {t('workbench.docs.body.conditions.intro1Prefix')}{' '}
        <code>declarativeNetRequest</code> {t('workbench.docs.body.conditions.intro1Suffix')}
      </DocParagraph>
      <DocParagraph>
        {t('workbench.docs.body.conditions.intro2Prefix')}{' '}
        <strong>{t('workbench.docs.body.conditions.exclStrong')}</strong>{' '}
        {t('workbench.docs.body.conditions.intro2Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.conditions.anatomyCaption')}>
        <ActionsRuleAnatomyDiagram focus="conditions" />
      </DiagramFrame>
      <DiagramFrame caption={t('workbench.docs.body.conditions.matchingCaption')}>
        <ConditionsMatchingDiagram />
      </DiagramFrame>
      <DiagramFrame caption={t('workbench.docs.body.conditions.hostVsOriginCaption')}>
        <ConditionsHostVsOriginDiagram />
      </DiagramFrame>
      <OnThisPage entries={CONDITION_ANCHORS.map((a) => ({ id: a.id, title: t(a.titleKey) }))} />

      <Anchor id="url-pattern">
        <Card
          title={t('workbench.docs.body.conditions.urlPatternTitle')}
          extra={<Tag color="blue">urlFilter</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.urlPattern1Prefix')} <code>*</code>{' '}
          {t('workbench.docs.body.conditions.urlPattern1Middle')} <code>*://</code>{' '}
          {t('workbench.docs.body.conditions.urlPattern1Middle2')} <code>https://</code>{' '}
          {t('workbench.docs.body.conditions.urlPattern1Suffix')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.urlPatternCaption')}>
            <UrlPatternDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="url-regex">
        <Card
          title={t('workbench.docs.body.conditions.urlRegexTitle')}
          extra={<Tag color="purple">regexFilter</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.urlRegex1')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.urlRegexCaption')}>
            <UrlRegexDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="request-domains">
        <Card
          title={t('workbench.docs.body.conditions.requestDomainsTitle')}
          extra={<Tag color="green">requestDomains</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.requestDomains1Prefix')}{' '}
          <code>api.</code>, <code>cdn.</code>, <code>www.</code>
          {t('workbench.docs.body.conditions.requestDomains1Suffix')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.requestDomainsCaption')}>
            <RequestDomainsDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="exclude-domains">
        <Card
          title={t('workbench.docs.body.conditions.excludeDomainsTitle')}
          extra={<Tag color="warning">excludedRequestDomains</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.excludeDomains1')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.excludeDomainsCaption')}>
            <ExcludeDomainsDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="initiator-domains">
        <Card
          title={t('workbench.docs.body.conditions.initiatorDomainsTitle')}
          extra={<Tag>initiatorDomains</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.initiatorDomains1')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.initiatorDomainsCaption')}>
            <InitiatorDomainsDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="methods">
        <Card
          title={t('workbench.docs.body.conditions.methodsTitle')}
          extra={<Tag>requestMethods</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.methods1')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.methodsCaption')}>
            <MethodsDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="condition-resource-types">
        <Card
          title={t('workbench.docs.body.conditions.resourceTypesTitle')}
          extra={<Tag>resourceTypes</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.resourceTypes1Prefix')}{' '}
          <DocLink to="resource-types">{t('workbench.docs.body.conditions.resourceTypesLink')}</DocLink>{' '}
          {t('workbench.docs.body.conditions.resourceTypes1Suffix')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.resourceTypesCaption')}>
            <ResourceTypesDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="domain-type">
        <Card
          title={t('workbench.docs.body.conditions.domainTypeTitle')}
          extra={<Tag>domainType</Tag>}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.domainType1Prefix')} <code>firstParty</code>{' '}
          {t('workbench.docs.body.conditions.domainType1Middle')} <code>thirdParty</code>{' '}
          {t('workbench.docs.body.conditions.domainType1Suffix')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.domainTypeCaption')}>
            <DomainTypeDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="headers">
        <Card
          title={t('workbench.docs.body.conditions.headersTitle')}
          extra={<BrowserTag min="chrome-128" />}
          style={{ marginBottom: 8 }}
        >
          {t('workbench.docs.body.conditions.headers1')}
          <DiagramFrame caption={t('workbench.docs.body.conditions.headersCaption')}>
            <HeadersConditionDiagram />
          </DiagramFrame>
        </Card>
      </Anchor>
    </>
  );
};
