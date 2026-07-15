import { Card, Tag, theme } from 'antd';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ActionsRuleAnatomyDiagram,
  ActionsTaxonomyDiagram,
  AppendDiagram,
  AppendWontApplyDiagram,
  BlockDiagram,
  BlockUseCasesDiagram,
  BlockWontApplyDiagram,
  DelayNavDiagram,
  DelayRoutingDiagram,
  DelayUseCasesDiagram,
  DelayWontApplyDiagram,
  DelayXhrDiagram,
  HeaderOpsDiagram,
  InjectCssDiagram,
  InjectScriptDiagram,
  InjectTimingDiagram,
  InjectUseCasesDiagram,
  InjectWontApplyDiagram,
  MergeDiagram,
  MergeWontApplyDiagram,
  MockDynamicDiagram,
  MockFlowDiagram,
  MockStaticDiagram,
  MockUseCasesDiagram,
  MockWontApplyDiagram,
  OverrideDiagram,
  OverrideWontApplyDiagram,
  QueryParamAddReplaceDiagram,
  QueryParamRemoveAllDiagram,
  QueryParamRemoveDiagram,
  QueryParamReplaceOnlyDiagram,
  QueryParamUseCasesDiagram,
  QueryParamWontApplyDiagram,
  RedirectRegexDiagram,
  RedirectStaticDiagram,
  RedirectUseCasesDiagram,
  RedirectWontApplyDiagram,
  RemoveDiagram,
  RemoveWontApplyDiagram,
  RequestBodyDynamicDiagram,
  RequestBodyGraphqlDiagram,
  RequestBodyInterceptDiagram,
  RequestBodyStaticDiagram,
  RequestBodyUseCasesDiagram,
  RequestBodyWontApplyDiagram,
} from '../diagrams';
import {
  Anchor,
  Callout,
  DiagramFrame,
  DocHeading,
  DocLink,
  DocParagraph,
  EngineTag,
  OnThisPage,
  SurfaceContext,
} from '../shared';

// ── Actions overview (concept page that unites all action pages) ───

const ACTION_ANCHORS: { id: string; titleKey: MessageKey }[] = [
  { id: 'modify-request', titleKey: 'workbench.docs.body.actions.modifyRequestTitle' },
  { id: 'modify-response', titleKey: 'workbench.docs.body.actions.modifyResponseTitle' },
  { id: 'run-code', titleKey: 'workbench.docs.body.actions.runCodeTitle' },
];

export const ActionsSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>
        {t('workbench.docs.body.actions.intro1Prefix')} <strong>{t('workbench.docs.body.actions.introDo')}</strong>{' '}
        {t('workbench.docs.body.actions.intro1Middle')}{' '}
        <DocLink to="conditions">{t('workbench.docs.body.actions.conditionLink')}</DocLink>{' '}
        {t('workbench.docs.body.actions.intro1Middle2')} <em>{t('workbench.docs.body.actions.introWhether')}</em>{' '}
        {t('workbench.docs.body.actions.intro1Middle3')}{' '}
        <em>{t('workbench.docs.body.actions.introWhatChanges')}</em>
        {t('workbench.docs.body.actions.intro1Suffix')}
      </DocParagraph>
      <DocParagraph>
        {t('workbench.docs.body.actions.categories1')}{' '}
        <strong>{t('workbench.docs.body.actions.engineDnr')}</strong>{' '}
        {t('workbench.docs.body.actions.categoriesDnrParen')}
        <code>declarativeNetRequest</code>
        {t('workbench.docs.body.actions.categoriesDnrSuffix')}{' '}
        <strong>{t('workbench.docs.body.actions.engineScript')}</strong>{' '}
        {t('workbench.docs.body.actions.categoriesScriptParen')}{' '}
        <DocLink to="execution">{t('workbench.docs.body.actions.executionLink')}</DocLink>{' '}
        {t('workbench.docs.body.actions.categories1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.actions.ruleAnatomyCaption')}>
        <ActionsRuleAnatomyDiagram />
      </DiagramFrame>
      <DiagramFrame caption={t('workbench.docs.body.actions.taxonomyCaption')}>
        <ActionsTaxonomyDiagram />
      </DiagramFrame>
      <OnThisPage entries={ACTION_ANCHORS.map((a) => ({ id: a.id, title: t(a.titleKey) }))} />

      <Anchor id="modify-request">
        <Card
          title={t('workbench.docs.body.actions.modifyRequestTitle')}
          extra={<Tag color="blue">{t('workbench.docs.body.actions.tagRequest')}</Tag>}
          style={{ marginBottom: 8 }}
        >
          <DocParagraph>{t('workbench.docs.body.actions.modifyRequest1')}</DocParagraph>
          <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 22 }}>
            <li>
              <DocLink to="header-actions">{t('workbench.docs.body.actions.headerActionsLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liHeaderActionsRequest')}
            </li>
            <li>
              <DocLink to="block">{t('workbench.docs.body.actions.blockLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liBlock')}
            </li>
            <li>
              <DocLink to="redirect">{t('workbench.docs.body.actions.redirectLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liRedirect')}
            </li>
            <li>
              <DocLink to="query-param">{t('workbench.docs.body.actions.queryParamsLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liQueryParams')}
            </li>
            <li>
              <DocLink to="request-body">{t('workbench.docs.body.actions.requestBodyLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liRequestBody')}
            </li>
          </ul>
        </Card>
      </Anchor>

      <Anchor id="modify-response">
        <Card
          title={t('workbench.docs.body.actions.modifyResponseTitle')}
          extra={<Tag color="green">{t('workbench.docs.body.actions.tagResponse')}</Tag>}
          style={{ marginBottom: 8 }}
        >
          <DocParagraph>{t('workbench.docs.body.actions.modifyResponse1')}</DocParagraph>
          <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 22 }}>
            <li>
              <DocLink to="header-actions">{t('workbench.docs.body.actions.headerActionsLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liHeaderActionsResponse')}
            </li>
            <li>
              <DocLink to="response">{t('workbench.docs.body.actions.responseLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liResponse')}
            </li>
          </ul>
        </Card>
      </Anchor>

      <Anchor id="run-code">
        <Card
          title={t('workbench.docs.body.actions.runCodeTitle')}
          extra={<Tag color="purple">{t('workbench.docs.body.actions.tagRunCode')}</Tag>}
          style={{ marginBottom: 8 }}
        >
          <DocParagraph>{t('workbench.docs.body.actions.runCode1')}</DocParagraph>
          <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 22 }}>
            <li>
              <DocLink to="inject">{t('workbench.docs.body.actions.injectLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liInject')}
            </li>
            <li>
              <DocLink to="delay">{t('workbench.docs.body.actions.delayLink')}</DocLink>{' '}
              {t('workbench.docs.body.actions.liDelay')}
            </li>
          </ul>
        </Card>
      </Anchor>

      <Callout kind="tip" title={t('workbench.docs.body.actions.oneActionTitle')}>
        {t('workbench.docs.body.actions.oneAction1')}
      </Callout>
    </>
  );
};

// ── Actions: Header Actions ──────────────────────────────────────

const ActionHeading: React.FC<{ title: string; engine: 'dnr' | 'script' }> = ({ title, engine }) => (
  <DocHeading level={3}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {title} <EngineTag kind={engine} />
    </span>
  </DocHeading>
);

export const HeaderActionsSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>{t('workbench.docs.body.headerActions.intro')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.headerActions.opsCaption')}>
        <HeaderOpsDiagram />
      </DiagramFrame>

      <Anchor id="override">
        <ActionHeading title={t('workbench.docs.body.headerActions.overrideTitle')} engine="dnr" />
        <DocParagraph>{t('workbench.docs.body.headerActions.override1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.overrideCaption')}>
          <OverrideDiagram />
        </DiagramFrame>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.overrideWontApplyCaption')}>
          <OverrideWontApplyDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="append">
        <ActionHeading title={t('workbench.docs.body.headerActions.appendTitle')} engine="dnr" />
        <DocParagraph>{t('workbench.docs.body.headerActions.append1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.appendCaption')}>
          <AppendDiagram />
        </DiagramFrame>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.appendWontApplyCaption')}>
          <AppendWontApplyDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="remove">
        <ActionHeading title={t('workbench.docs.body.headerActions.removeTitle')} engine="dnr" />
        <DocParagraph>{t('workbench.docs.body.headerActions.remove1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.removeCaption')}>
          <RemoveDiagram />
        </DiagramFrame>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.removeWontApplyCaption')}>
          <RemoveWontApplyDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="merge">
        <ActionHeading title={t('workbench.docs.body.headerActions.mergeTitle')} engine="script" />
        <DocParagraph>
          {t('workbench.docs.body.headerActions.merge1Prefix')} <code>{'; '}</code>{' '}
          {t('workbench.docs.body.headerActions.merge1Middle')} <code>{', '}</code>{' '}
          {t('workbench.docs.body.headerActions.merge1Suffix')}
        </DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.mergeCaption')}>
          <MergeDiagram />
        </DiagramFrame>
        <DiagramFrame caption={t('workbench.docs.body.headerActions.mergeWontApplyCaption')}>
          <MergeWontApplyDiagram />
        </DiagramFrame>
        <Callout kind="limitation">{t('workbench.docs.body.headerActions.mergeLimitation')}</Callout>
      </Anchor>
    </>
  );
};

// ── Actions: Block / Redirect / QueryParam / Inject / Delay / Request Body / Response ──

export const BlockSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>{t('workbench.docs.body.block.intro')}</DocParagraph>

      <ActionHeading title={t('workbench.docs.body.block.howTitle')} engine="dnr" />
      <DocParagraph>
        {t('workbench.docs.body.block.how1Prefix')} <code>block</code> {t('workbench.docs.body.block.how1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.block.blockCaption')}>
        <BlockDiagram />
      </DiagramFrame>
      <DiagramFrame caption={t('workbench.docs.body.block.wontApplyCaption')}>
        <BlockWontApplyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.block.whenTitle')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.block.when1Prefix')} <code>main_frame</code>
        {t('workbench.docs.body.block.when1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.block.useCasesCaption')}>
        <BlockUseCasesDiagram />
      </DiagramFrame>
      <Callout kind="note">
        {t('workbench.docs.body.block.note1Prefix')} <code>main_frame</code>{' '}
        {t('workbench.docs.body.block.note1Suffix')}
      </Callout>
    </>
  );
};

export const RedirectSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>{t('workbench.docs.body.redirect.intro')}</DocParagraph>

      <Anchor id="redirect-url">
        <ActionHeading title={t('workbench.docs.body.redirect.staticTitle')} engine="dnr" />
        <DocParagraph>{t('workbench.docs.body.redirect.static1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.redirect.staticCaption')}>
          <RedirectStaticDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="redirect-regex">
        <ActionHeading title={t('workbench.docs.body.redirect.regexTitle')} engine="dnr" />
        <DocParagraph>
          {t('workbench.docs.body.redirect.regex1Prefix')} <code>\1</code>, <code>\2</code>
          {t('workbench.docs.body.redirect.regex1Suffix')}
        </DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.redirect.regexCaption')}>
          <RedirectRegexDiagram />
        </DiagramFrame>
      </Anchor>

      <DiagramFrame caption={t('workbench.docs.body.redirect.wontApplyCaption')}>
        <RedirectWontApplyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.redirect.whenTitle')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.redirect.when1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.redirect.useCasesCaption')}>
        <RedirectUseCasesDiagram />
      </DiagramFrame>
    </>
  );
};

export const QueryParamSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>
        {t('workbench.docs.body.queryParam.introPrefix')} <code>queryTransform</code>{' '}
        {t('workbench.docs.body.queryParam.introSuffix')}
      </DocParagraph>

      <Anchor id="qp-add">
        <ActionHeading title={t('workbench.docs.body.queryParam.addTitle')} engine="dnr" />
        <DocParagraph>{t('workbench.docs.body.queryParam.add1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.queryParam.addCaption')}>
          <QueryParamAddReplaceDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="qp-override">
        <ActionHeading title={t('workbench.docs.body.queryParam.replaceOnlyTitle')} engine="dnr" />
        <DocParagraph>
          {t('workbench.docs.body.queryParam.replaceOnly1Prefix')}{' '}
          <strong>{t('workbench.docs.body.queryParam.replaceOnlyStrong')}</strong>
          {t('workbench.docs.body.queryParam.replaceOnly1Middle')} <code>region=eu</code>{' '}
          {t('workbench.docs.body.queryParam.replaceOnly1Suffix')}
        </DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.queryParam.replaceOnlyCaption')}>
          <QueryParamReplaceOnlyDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="qp-remove">
        <ActionHeading title={t('workbench.docs.body.queryParam.removeTitle')} engine="dnr" />
        <DocParagraph>{t('workbench.docs.body.queryParam.remove1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.queryParam.removeCaption')}>
          <QueryParamRemoveDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="qp-remove-all">
        <ActionHeading title={t('workbench.docs.body.queryParam.removeAllTitle')} engine="dnr" />
        <DocParagraph>{t('workbench.docs.body.queryParam.removeAll1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.queryParam.removeAllCaption')}>
          <QueryParamRemoveAllDiagram />
        </DiagramFrame>
      </Anchor>

      <DiagramFrame caption={t('workbench.docs.body.queryParam.wontApplyCaption')}>
        <QueryParamWontApplyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.queryParam.whenTitle')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.queryParam.when1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.queryParam.useCasesCaption')}>
        <QueryParamUseCasesDiagram />
      </DiagramFrame>
    </>
  );
};

export const InjectSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>{t('workbench.docs.body.inject.intro')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.inject.timingCaption')}>
        <InjectTimingDiagram />
      </DiagramFrame>

      <Anchor id="inject-script">
        <ActionHeading title={t('workbench.docs.body.inject.scriptTitle')} engine="script" />
        <DocParagraph>{t('workbench.docs.body.inject.script1')}</DocParagraph>
        <DocParagraph>
          <strong>{t('workbench.docs.body.inject.asapStrong')}</strong> {t('workbench.docs.body.inject.asap1')}{' '}
          <code>fetch</code> {t('workbench.docs.body.inject.asap1Suffix')}
        </DocParagraph>
        <DocParagraph>
          <strong>{t('workbench.docs.body.inject.afterStrong')}</strong> {t('workbench.docs.body.inject.after1')}
        </DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.inject.scriptCaption')}>
          <InjectScriptDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="inject-css">
        <ActionHeading title={t('workbench.docs.body.inject.cssTitle')} engine="script" />
        <DocParagraph>
          {t('workbench.docs.body.inject.css1Prefix')} <code>&lt;style&gt;</code>{' '}
          {t('workbench.docs.body.inject.css1Suffix')}
        </DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.inject.cssCaption')}>
          <InjectCssDiagram />
        </DiagramFrame>
      </Anchor>

      <DiagramFrame caption={t('workbench.docs.body.inject.wontApplyCaption')}>
        <InjectWontApplyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.inject.whenTitle')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.inject.when1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.inject.useCasesCaption')}>
        <InjectUseCasesDiagram />
      </DiagramFrame>
    </>
  );
};

export const DelaySection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>{t('workbench.docs.body.delay.intro')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.delay.routingCaption')}>
        <DelayRoutingDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.delay.navHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.delay.nav1Prefix')} <strong>{t('workbench.docs.body.delay.navMs')}</strong>{' '}
        {t('workbench.docs.body.delay.nav1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.delay.navCaption')}>
        <DelayNavDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.delay.xhrHeading')}</DocHeading>
      <DocParagraph>
        {t('workbench.docs.body.delay.xhr1Prefix')} <code>fetch()</code> / <code>XMLHttpRequest</code>{' '}
        {t('workbench.docs.body.delay.xhr1Middle')} <strong>{t('workbench.docs.body.delay.xhrMs')}</strong>{' '}
        {t('workbench.docs.body.delay.xhr1Suffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.delay.xhrCaption')}>
        <DelayXhrDiagram />
      </DiagramFrame>

      <DiagramFrame caption={t('workbench.docs.body.delay.wontApplyCaption')}>
        <DelayWontApplyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.delay.whenTitle')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.delay.when1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.delay.useCasesCaption')}>
        <DelayUseCasesDiagram />
      </DiagramFrame>

      <Callout kind="note" title={t('workbench.docs.body.delay.desktopNoteTitle')}>
        {t('workbench.docs.body.delay.desktopNote1')}
      </Callout>
    </>
  );
};

export const RequestBodySection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>
        {t('workbench.docs.body.requestBody.introPrefix')} <code>fetch()</code>{' '}
        {t('workbench.docs.body.requestBody.introAnd')} <code>XMLHttpRequest</code>
        {t('workbench.docs.body.requestBody.introDot')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.requestBody.interceptCaption')}>
        <RequestBodyInterceptDiagram />
      </DiagramFrame>

      <Anchor id="request-body-static">
        <ActionHeading title={t('workbench.docs.body.requestBody.staticTitle')} engine="script" />
        <DocParagraph>{t('workbench.docs.body.requestBody.static1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.requestBody.staticCaption')}>
          <RequestBodyStaticDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="request-body-dynamic">
        <ActionHeading title={t('workbench.docs.body.requestBody.dynamicTitle')} engine="script" />
        <DocParagraph>
          {t('workbench.docs.body.requestBody.dynamic1')} <code>{'{ method, url, body, bodyAsJson }'}</code>
          {t('workbench.docs.body.requestBody.dynamicDot')}
        </DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.requestBody.dynamicCaption')}>
          <RequestBodyDynamicDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="request-body-graphql">
        <ActionHeading title={t('workbench.docs.body.requestBody.graphqlTitle')} engine="script" />
        <DocParagraph>
          {t('workbench.docs.body.requestBody.graphql1Prefix')} <code>key</code>
          {t('workbench.docs.body.requestBody.graphql1Middle')} <code>value</code>{' '}
          {t('workbench.docs.body.requestBody.graphql1Middle2')}
          <code>Equals</code> {t('workbench.docs.body.requestBody.graphql1Middle3')} <code>Contains</code>{' '}
          {t('workbench.docs.body.requestBody.graphql1Suffix')}
        </DocParagraph>
        <DocParagraph>
          {t('workbench.docs.body.requestBody.graphql2Prefix')} <code>operationName</code>{' '}
          {t('workbench.docs.body.requestBody.graphql2Middle')} <code>query</code>{' '}
          {t('workbench.docs.body.requestBody.graphql2Suffix')}
        </DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.requestBody.graphqlCaption')}>
          <RequestBodyGraphqlDiagram />
        </DiagramFrame>
      </Anchor>

      <DiagramFrame caption={t('workbench.docs.body.requestBody.wontApplyCaption')}>
        <RequestBodyWontApplyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.requestBody.whenTitle')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.requestBody.when1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.requestBody.useCasesCaption')}>
        <RequestBodyUseCasesDiagram />
      </DiagramFrame>
    </>
  );
};

export const ResponseSection: React.FC = () => {
  const t = useT();
  return (
    <>
      <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
      <DocParagraph>
        {t('workbench.docs.body.response.introPrefix')} <code>fetch()</code>{' '}
        {t('workbench.docs.body.response.introAnd')} <code>XMLHttpRequest</code>
        {t('workbench.docs.body.response.introDot')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.response.flowCaption')}>
        <MockFlowDiagram />
      </DiagramFrame>

      <Anchor id="response-static">
        <ActionHeading title={t('workbench.docs.body.response.staticTitle')} engine="script" />
        <DocParagraph>{t('workbench.docs.body.response.static1')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.response.staticCaption')}>
          <MockStaticDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="response-dynamic">
        <ActionHeading title={t('workbench.docs.body.response.dynamicTitle')} engine="script" />
        <DocParagraph>
          {t('workbench.docs.body.response.dynamic1')} <code>{'{ status, body, bodyAsJson, url, method }'}</code>
          {t('workbench.docs.body.response.dynamicDot')}
        </DocParagraph>
        <DocParagraph>{t('workbench.docs.body.response.dynamic2')}</DocParagraph>
        <DiagramFrame caption={t('workbench.docs.body.response.dynamicCaption')}>
          <MockDynamicDiagram />
        </DiagramFrame>
      </Anchor>

      <Anchor id="response-graphql">
        <ActionHeading title={t('workbench.docs.body.response.graphqlTitle')} engine="script" />
        <DocParagraph>{t('workbench.docs.body.response.graphql1')}</DocParagraph>
      </Anchor>

      <DiagramFrame caption={t('workbench.docs.body.response.wontApplyCaption')}>
        <MockWontApplyDiagram />
      </DiagramFrame>

      <DocHeading level={3}>{t('workbench.docs.body.response.whenTitle')}</DocHeading>
      <DocParagraph>{t('workbench.docs.body.response.when1')}</DocParagraph>
      <DiagramFrame caption={t('workbench.docs.body.response.useCasesCaption')}>
        <MockUseCasesDiagram />
      </DiagramFrame>
    </>
  );
};
