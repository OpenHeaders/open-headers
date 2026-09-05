/**
 * The meta strip's GraphQL tags — the `errors[]` tag (error tone: the
 * status pill alone would read the 200-with-errors trap as success)
 * with a popover listing every error's message, path, location and
 * code, and the neutral `extensions` tag whose popover shows the
 * server's object verbatim. Rendered only for a GraphQL send's answer
 * (the editor derives the facts; see `graphql-response.ts`).
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Tag, theme } from 'antd';
import type React from 'react';
import type { GraphqlResponseFacts } from './graphql-response';

function ErrorList({ facts }: { facts: GraphqlResponseFacts }) {
  const { token } = theme.useToken();
  const t = useT();
  const note: React.CSSProperties = { fontSize: 11, color: token.colorTextTertiary, fontFamily: 'monospace' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260, maxWidth: 420 }}>
      {facts.errors.map((error, index) => (
        <div
          key={`${index}-${error.message}`}
          data-testid="oh-response-graphql-error"
          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <span style={{ fontSize: 12, wordBreak: 'break-word' }}>{error.message}</span>
          {(error.path !== null || error.location !== null || error.code !== null) && (
            <span style={note}>
              {[
                error.path === null ? null : `path ${error.path}`,
                error.location === null ? null : `at ${error.location}`,
                error.code,
              ]
                .filter((part): part is string => part !== null)
                .join(' · ')}
            </span>
          )}
        </div>
      ))}
      {facts.dataNull && (
        <span style={{ fontSize: 11, color: token.colorTextTertiary, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 6 }}>
          {t('workbench.editors.graphql.response.dataNull')}
        </span>
      )}
    </div>
  );
}

function errorsContent(facts: GraphqlResponseFacts, status: number, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.graphql.response.errorsTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.graphql.response.errorsSummary', { status }),
    description: <ErrorList facts={facts} />,
  };
}

function extensionsContent(facts: GraphqlResponseFacts, t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.editors.graphql.response.extensionsTitle'),
    kicker: t('workbench.editors.request.response.meta.kicker'),
    summary: t('workbench.editors.graphql.response.extensionsSummary'),
    description: (
      <pre
        data-testid="oh-response-graphql-extensions-json"
        style={{ margin: 0, fontSize: 11, maxWidth: 420, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}
      >
        {facts.extensionsJson}
      </pre>
    ),
  };
}

export const GraphqlErrorsTag: React.FC<{ facts: GraphqlResponseFacts; status: number }> = ({ facts, status }) => {
  const t = useT();
  return (
    <InfoPopover content={errorsContent(facts, status, t)} trigger="hover">
      <Tag color="error" data-testid="oh-response-graphql-errors" style={{ marginInlineEnd: 0, cursor: 'help' }}>
        {t('workbench.editors.graphql.response.errors', { count: facts.errors.length })}
      </Tag>
    </InfoPopover>
  );
};

export const GraphqlExtensionsTag: React.FC<{ facts: GraphqlResponseFacts }> = ({ facts }) => {
  const t = useT();
  return (
    <InfoPopover content={extensionsContent(facts, t)} trigger="hover">
      <Tag color="default" data-testid="oh-response-graphql-extensions" style={{ marginInlineEnd: 0, cursor: 'help' }}>
        {t('workbench.editors.graphql.response.extensions')}
      </Tag>
    </InfoPopover>
  );
};
