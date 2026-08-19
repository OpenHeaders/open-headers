/**
 * Filter Syntax — the panel docs' reference for the traffic filter
 * input, in the workbench docs card idiom: one Card per concept, each
 * with a diagram that filters the SAME five-request example capture
 * (see `filter-example.tsx`), so every card is a different slice of one
 * picture.
 */

import { Card, Tag } from 'antd';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Anchor, DiagramFrame, DocHeading, DocParagraph, OnThisPage } from '@openheaders/ui/shared/docs/shared';
import { FilterExample } from '../filter-example';

const FILTER_ANCHORS: { id: string; titleKey: MessageKey }[] = [
  { id: 'filter-text', titleKey: 'panel.docs.filterSyntax.textTitle' },
  { id: 'filter-negation', titleKey: 'panel.docs.filterSyntax.negationTitle' },
  { id: 'filter-phrase', titleKey: 'panel.docs.filterSyntax.phraseTitle' },
  { id: 'filter-domain', titleKey: 'panel.docs.filterSyntax.domainTitle' },
  { id: 'filter-status-code', titleKey: 'panel.docs.filterSyntax.statusCodeTitle' },
  { id: 'filter-method', titleKey: 'panel.docs.filterSyntax.methodTitle' },
  { id: 'filter-mime-type', titleKey: 'panel.docs.filterSyntax.mimeTypeTitle' },
  { id: 'filter-has-response-header', titleKey: 'panel.docs.filterSyntax.responseHeaderTitle' },
  { id: 'filter-larger-than', titleKey: 'panel.docs.filterSyntax.largerThanTitle' },
  { id: 'filter-from-cache', titleKey: 'panel.docs.filterSyntax.fromCacheTitle' },
  { id: 'filter-match-case', titleKey: 'panel.docs.filterSyntax.matchCaseTitle' },
  { id: 'filter-whole-word', titleKey: 'panel.docs.filterSyntax.wholeWordTitle' },
  { id: 'filter-regex', titleKey: 'panel.docs.filterSyntax.regexTitle' },
  { id: 'filter-other-inputs', titleKey: 'panel.docs.filterSyntax.otherInputsTitle' },
];

const CARD_STYLE = { marginBottom: 8 } as const;

export function FilterSyntaxSection() {
  const t = useT();
  return (
    <div>
      <DocParagraph>
        {t('panel.docs.filterSyntax.intro1Prefix')} <code>key:value</code>{' '}
        {t('panel.docs.filterSyntax.intro1Suffix')}
      </DocParagraph>
      <DocParagraph>
        {t('panel.docs.filterSyntax.intro2Prefix')} (<code>Aa</code>{' '}
        {t('panel.docs.filterSyntax.intro2MatchCase')}, <code>ab</code>{' '}
        {t('panel.docs.filterSyntax.intro2WholeWord')}, <code>.*</code>{' '}
        {t('panel.docs.filterSyntax.intro2Regex')}) {t('panel.docs.filterSyntax.intro2Middle')} <code>×</code>{' '}
        {t('panel.docs.filterSyntax.intro2Suffix')} {t('panel.docs.filterSyntax.intro2Kbd')} <code>Alt+C</code> /{' '}
        <code>Alt+W</code> / <code>Alt+R</code> {t('panel.docs.filterSyntax.intro2KbdSuffix')}
      </DocParagraph>
      <OnThisPage entries={FILTER_ANCHORS.map((a) => ({ id: a.id, title: t(a.titleKey) }))} />

      <DocHeading>{t('panel.docs.filterSyntax.headingText')}</DocHeading>

      <Anchor id="filter-text">
        <Card
          title={t('panel.docs.filterSyntax.textTitle')}
          extra={
            <Tag color="blue">
              <code>api users</code>
            </Tag>
          }
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.text1')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.textCaption')}>
            <FilterExample
              filter="api users"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: false, reason: 'contains “api” but not “users”' },
                { id: 'app', pass: false, reason: 'contains neither term' },
                { id: 'font', pass: false, reason: 'contains neither term' },
                { id: 'pixel', pass: false, reason: 'contains neither term' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-negation">
        <Card
          title={t('panel.docs.filterSyntax.negationTitle')}
          extra={<Tag color="blue">-term</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.negation1Prefix')} <code>-</code>{' '}
          {t('panel.docs.filterSyntax.negation1Middle')} <code>-analytics</code>{' '}
          {t('panel.docs.filterSyntax.negation1Middle2')} <code>-domain:ads.example</code>,{' '}
          <code>-is:from-cache</code>.
          <DiagramFrame caption={t('panel.docs.filterSyntax.negationCaption')}>
            <FilterExample
              filter="-analytics"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: true },
                { id: 'app', pass: true },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'URL contains “analytics”' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-phrase">
        <Card title={t('panel.docs.filterSyntax.phraseTitle')} extra={<Tag color="blue">"…"</Tag>} style={CARD_STYLE}>
          {t('panel.docs.filterSyntax.phrase1Prefix')} <code>?</code> {t('panel.docs.filterSyntax.phrase1Or')}{' '}
          <code>=</code> {t('panel.docs.filterSyntax.phrase1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.phraseCaption')}>
            <FilterExample
              filter='"users?page=2"'
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: false, reason: 'no such phrase in the URL' },
                { id: 'app', pass: false, reason: 'no such phrase in the URL' },
                { id: 'font', pass: false, reason: 'no such phrase in the URL' },
                { id: 'pixel', pass: false, reason: 'no such phrase in the URL' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <DocHeading>{t('panel.docs.filterSyntax.headingProperty')}</DocHeading>
      <DocParagraph>
        {t('panel.docs.filterSyntax.propertyIntroPrefix')} <code>key:value</code>{' '}
        {t('panel.docs.filterSyntax.propertyIntroSuffix')}
      </DocParagraph>

      <Anchor id="filter-domain">
        <Card
          title={t('panel.docs.filterSyntax.domainTitle')}
          extra={<Tag color="green">domain:</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.domain1Prefix')} <code>api.</code>, <code>cdn.</code>, <code>static.</code>{' '}
          {t('panel.docs.filterSyntax.domain1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.domainCaption')}>
            <FilterExample
              filter="domain:openheaders.com"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: true },
                { id: 'app', pass: true },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'hostname is tracker-example.net' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-status-code">
        <Card
          title={t('panel.docs.filterSyntax.statusCodeTitle')}
          extra={<Tag color="green">status-code:</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.statusCode1')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.statusCodeCaption')}>
            <FilterExample
              filter="status-code:404"
              verdicts={[
                { id: 'users', pass: false, reason: 'status is 200' },
                { id: 'login', pass: false, reason: 'status is 201' },
                { id: 'app', pass: false, reason: 'status is 200' },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'status is 200' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-method">
        <Card
          title={t('panel.docs.filterSyntax.methodTitle')}
          extra={<Tag color="green">method:</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.method1Prefix')} <code>method:post</code>{' '}
          {t('panel.docs.filterSyntax.method1And')} <code>method:POST</code>{' '}
          {t('panel.docs.filterSyntax.method1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.methodCaption')}>
            <FilterExample
              filter="method:POST"
              verdicts={[
                { id: 'users', pass: false, reason: 'method is GET' },
                { id: 'login', pass: true },
                { id: 'app', pass: false, reason: 'method is GET' },
                { id: 'font', pass: false, reason: 'method is GET' },
                { id: 'pixel', pass: false, reason: 'method is GET' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-mime-type">
        <Card
          title={t('panel.docs.filterSyntax.mimeTypeTitle')}
          extra={<Tag color="green">mime-type:</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.mime1Prefix')} <code>mime-type:json</code>{' '}
          {t('panel.docs.filterSyntax.mime1Catches')} <code>application/json</code>, <code>mime-type:image</code>{' '}
          {t('panel.docs.filterSyntax.mime1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.mimeCaption')}>
            <FilterExample
              filter="mime-type:json"
              verdicts={[
                { id: 'users', pass: true },
                { id: 'login', pass: true },
                { id: 'app', pass: false, reason: 'text/javascript' },
                { id: 'font', pass: false, reason: 'not a JSON response' },
                { id: 'pixel', pass: false, reason: 'image/gif' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-has-response-header">
        <Card
          title={t('panel.docs.filterSyntax.responseHeaderTitle')}
          extra={<Tag color="green">has-response-header:</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.respHeader1Prefix')} (<code>x-cache</code>){' '}
          {t('panel.docs.filterSyntax.respHeader1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.respHeaderCaption')}>
            <FilterExample
              filter="has-response-header:x-cache"
              verdicts={[
                { id: 'users', pass: false, reason: 'no x-cache header' },
                { id: 'login', pass: false, reason: 'no x-cache header' },
                { id: 'app', pass: true },
                { id: 'font', pass: false, reason: 'no x-cache header' },
                { id: 'pixel', pass: false, reason: 'no x-cache header' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-larger-than">
        <Card
          title={t('panel.docs.filterSyntax.largerThanTitle')}
          extra={<Tag color="green">larger-than:</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.largerThan1')} <code>larger-than:100k</code>, <code>larger-than:1M</code>.
          <DiagramFrame caption={t('panel.docs.filterSyntax.largerThanCaption')}>
            <FilterExample
              filter="larger-than:100k"
              verdicts={[
                { id: 'users', pass: false, reason: '1.2 kB' },
                { id: 'login', pass: false, reason: '0.4 kB' },
                { id: 'app', pass: true },
                { id: 'font', pass: false, reason: '2.1 kB' },
                { id: 'pixel', pass: false, reason: '0.1 kB' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-from-cache">
        <Card
          title={t('panel.docs.filterSyntax.fromCacheTitle')}
          extra={<Tag color="green">is:from-cache</Tag>}
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.fromCache1Prefix')} <code>304</code>
          {t('panel.docs.filterSyntax.fromCache1Middle')} (<code>-is:from-cache</code>){' '}
          {t('panel.docs.filterSyntax.fromCache1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.fromCacheCaption')}>
            <FilterExample
              filter="is:from-cache"
              verdicts={[
                { id: 'users', pass: false, reason: 'served from the network' },
                { id: 'login', pass: false, reason: 'served from the network' },
                { id: 'app', pass: false, reason: 'served from the network' },
                { id: 'font', pass: false, reason: 'served from the network' },
                { id: 'pixel', pass: true },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <DocHeading>{t('panel.docs.filterSyntax.headingToggles')}</DocHeading>
      <DocParagraph>
        {t('panel.docs.filterSyntax.togglesIntroPrefix')} <code>name:</code>/<code>value:</code>{' '}
        {t('panel.docs.filterSyntax.togglesIntroMiddle')} <code>is:</code>{' '}
        {t('panel.docs.filterSyntax.togglesIntroSuffix')}
      </DocParagraph>

      <Anchor id="filter-match-case">
        <Card
          title={t('panel.docs.filterSyntax.matchCaseTitle')}
          extra={
            <Tag>
              <code>Aa · Alt+C</code>
            </Tag>
          }
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.matchCase1Prefix')} <code>V1</code>{' '}
          {t('panel.docs.filterSyntax.matchCase1And')} <code>v1</code>{' '}
          {t('panel.docs.filterSyntax.matchCase1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.matchCaseCaption')}>
            <FilterExample
              filter="Users"
              toggles={{ matchCase: true }}
              verdicts={[
                { id: 'users', pass: false, reason: 'URL says “users” — case differs' },
                { id: 'login', pass: false, reason: 'no match' },
                { id: 'app', pass: false, reason: 'no match' },
                { id: 'font', pass: false, reason: 'no match' },
                { id: 'pixel', pass: false, reason: 'no match' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-whole-word">
        <Card
          title={t('panel.docs.filterSyntax.wholeWordTitle')}
          extra={
            <Tag>
              <code>ab · Alt+W</code>
            </Tag>
          }
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.wholeWord1Prefix')} <code>/</code>, <code>.</code>, <code>?</code>,{' '}
          <code>=</code> {t('panel.docs.filterSyntax.wholeWord1Suffix')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.wholeWordCaption')}>
            <FilterExample
              filter="user"
              toggles={{ wholeWord: true }}
              verdicts={[
                { id: 'users', pass: false, reason: '“user” only appears inside “users”' },
                { id: 'login', pass: false, reason: 'no match' },
                { id: 'app', pass: false, reason: 'no match' },
                { id: 'font', pass: false, reason: 'no match' },
                { id: 'pixel', pass: false, reason: 'no match' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <Anchor id="filter-regex">
        <Card
          title={t('panel.docs.filterSyntax.regexTitle')}
          extra={
            <Tag color="purple">
              <code>.* · Alt+R</code>
            </Tag>
          }
          style={CARD_STYLE}
        >
          {t('panel.docs.filterSyntax.regex1')}
          <DiagramFrame caption={t('panel.docs.filterSyntax.regexCaption')}>
            <FilterExample
              filter="\.(js|woff2)$"
              toggles={{ regexMode: true }}
              verdicts={[
                { id: 'users', pass: false, reason: 'ends in a query string' },
                { id: 'login', pass: false, reason: 'ends in “login”' },
                { id: 'app', pass: true },
                { id: 'font', pass: true },
                { id: 'pixel', pass: false, reason: 'ends in “.gif”' },
              ]}
            />
          </DiagramFrame>
        </Card>
      </Anchor>

      <DocHeading>{t('panel.docs.filterSyntax.headingElsewhere')}</DocHeading>

      <Anchor id="filter-other-inputs">
        <Card title={t('panel.docs.filterSyntax.otherInputsTitle')} style={CARD_STYLE}>
          <DocParagraph>
            {t('panel.docs.filterSyntax.otherIntroPrefix')} <code>-</code>{' '}
            {t('panel.docs.filterSyntax.otherIntroSuffix')}
          </DocParagraph>
          <DocParagraph>
            <strong>{t('panel.inspector.sections.headers')}</strong> — <code>name:cookie</code>,{' '}
            <code>value:no-cache</code>, <code>is:rule</code>, <code>is:security</code>,{' '}
            <code>is:overridable</code>, <code>is:request</code> / <code>is:response</code>.
          </DocParagraph>
          <DocParagraph>
            <strong>{t('panel.inspector.sections.cookies')}</strong> — <code>name:sess</code>,{' '}
            <code>value:</code>, <code>domain:</code>, <code>path:</code>, <code>is:secure</code>,{' '}
            <code>is:samesite-none</code>,{' '}
            <code>is:third-party</code>, <code>is:problem</code>.
          </DocParagraph>
          <DocParagraph>
            <strong>{t('panel.inspector.sections.initiator')}</strong> — <code>is:failed</code>,{' '}
            <code>is:third-party</code>, <code>type:js</code>, <code>status:404</code>, <code>size:&gt;50kb</code>.
          </DocParagraph>
          <DocParagraph>
            <strong>{t('panel.docs.filterSyntax.otherPlainGroup')}</strong> —{' '}
            {t('panel.docs.filterSyntax.otherPlainBody')}
          </DocParagraph>
          <DocParagraph>
            <strong>{t('panel.toolWindows.search')}</strong> — {t('panel.docs.filterSyntax.otherSearchPrefix')}{' '}
            <code>.*</code>
            {t('panel.docs.filterSyntax.otherSearchMiddle')}{' '}
            <em>
              {t('panel.toolWindows.network')} / {t('panel.toolWindows.storage')} / {t('panel.toolWindows.console')}
            </em>{' '}
            {t('panel.docs.filterSyntax.otherSearchSuffix')}
          </DocParagraph>
        </Card>
      </Anchor>
    </div>
  );
}
