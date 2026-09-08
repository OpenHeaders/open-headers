/**
 * GraphqlSchemaTab — the schema plane's surface: the source select over
 * the two resolvable sources (introspection through the compile, a
 * linked `graphql` Spec) plus the import affordance that mints a Spec
 * from an SDL / introspection file and links it. Introspection shows
 * its fetched-at stamp and an explicit Refresh; its failures print
 * verbatim. The linked-spec source reads the spec binding (the
 * request's own ids-only `specLink`, else its collection's) and names
 * the spec — the LINK itself is the Spec tab's, the family's binding
 * surface, so this tab points there instead of carrying a second
 * picker; picking introspection while the request links its own spec
 * clears the link (a save-worthy change). A resolved schema reports
 * its size and roots; its build problems list beneath.
 */

import { isBuiltInScalar, isIntrospectionName } from '@openheaders/core/graphql';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Select, Tag, Typography } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import SpecEmptyCta from '../shared/SpecEmptyCta';
import { SPEC_FORMAT_LABELS } from '../specs/spec-format-labels';
import type { GraphqlSchemaSourceChoice, GraphqlSchemaState } from './use-graphql-schema';
import type { GraphqlSpecBindingState } from './useGraphqlSpecBinding';

const { Text } = Typography;

interface GraphqlSchemaTabProps {
  state: GraphqlSchemaState;
  specs: GraphqlSpecBindingState;
  /** The endpoint is set — introspection has somewhere to go. */
  hasUrl: boolean;
  /** Clears the request's own link (the introspection pick). */
  onUnlinkSpec: () => void;
  /** Opens the editor's schema file picker. */
  onImportSchema: () => void;
  /** Switches the editor to the Spec tab — where the link is set. */
  onOpenSpecTab: () => void;
}

const GraphqlSchemaTab: React.FC<GraphqlSchemaTabProps> = ({
  state,
  specs,
  hasUrl,
  onUnlinkSpec,
  onImportSchema,
  onOpenSpecTab,
}) => {
  const t = useT();
  const { binding, graphqlSpecs } = specs;
  // The select's own pick while no spec is linked yet — a link makes
  // the choice the entity's.
  const [pending, setPending] = useState<GraphqlSchemaSourceChoice | null>(null);
  const choice: GraphqlSchemaSourceChoice = binding.kind !== 'unlinked' ? 'spec' : (pending ?? 'introspection');
  // A link inherited from the collection is not the request's to
  // clear — introspection needs the request's own link, or none.
  const inheritedLink = binding.kind !== 'unlinked' && binding.source === 'collection';

  const summary = useMemo(() => {
    if (state.schema === null) return null;
    let count = 0;
    for (const type of state.schema.types.values()) {
      if (!isIntrospectionName(type.name) && !isBuiltInScalar(type.name)) count += 1;
    }
    const roots = [state.schema.queryType, state.schema.mutationType, state.schema.subscriptionType].filter(
      (name): name is string => name !== null,
    );
    return { count, roots };
  }, [state.schema]);

  const introspection = state.introspection;
  const fetchedAt =
    introspection.kind === 'ready' || (introspection.kind === 'error' && introspection.fetchedAt !== null)
      ? introspection.fetchedAt
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }} data-testid="graphql-schema-tab">
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.graphql.schema.sourceLabel')}
        </Text>
        <Select
          style={{ width: '100%' }}
          value={choice}
          options={[
            {
              value: 'introspection',
              label: t('workbench.editors.graphql.schema.source.introspection'),
              disabled: inheritedLink,
            },
            { value: 'spec', label: t('workbench.editors.graphql.schema.source.spec') },
          ]}
          onChange={(next: GraphqlSchemaSourceChoice) => {
            setPending(next);
            if (next === 'introspection' && binding.kind !== 'unlinked') onUnlinkSpec();
          }}
          data-testid="graphql-schema-source"
        />
      </div>

      {choice === 'introspection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="graphql-schema-introspection">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {fetchedAt !== null
              ? t('workbench.editors.graphql.schema.fetchedAt', { when: new Date(fetchedAt).toLocaleString() })
              : t('workbench.editors.graphql.schema.notIntrospected')}
          </Text>
          {introspection.kind === 'error' && (
            <Text type="danger" style={{ fontSize: 12 }} data-testid="graphql-schema-error">
              {t('workbench.editors.graphql.schema.introspectFailed', { message: introspection.message })}
            </Text>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Button
              size="small"
              type="primary"
              loading={introspection.kind === 'loading'}
              disabled={!hasUrl}
              onClick={() => void state.introspect()}
              data-testid="graphql-schema-introspect"
            >
              {fetchedAt !== null
                ? t('workbench.editors.graphql.schema.refresh')
                : t('workbench.editors.graphql.explorer.introspect')}
            </Button>
            {!hasUrl && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('workbench.editors.graphql.explorer.needsUrl')}
              </Text>
            )}
          </div>
        </div>
      )}

      {choice === 'spec' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="graphql-schema-spec">
          {binding.kind === 'unlinked' && graphqlSpecs.length === 0 ? (
            <SpecEmptyCta format={SPEC_FORMAT_LABELS.graphql} testid="graphql-schema-spec-empty" />
          ) : binding.kind === 'unlinked' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workbench.editors.graphql.schema.noSpecLinked')}
              </Text>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12, height: 'auto' }}
                onClick={onOpenSpecTab}
                data-testid="graphql-schema-spec-link"
              >
                {t('workbench.editors.graphql.schema.linkInSpecTab')}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {binding.kind === 'linked' && (
                <>
                  <Text style={{ fontSize: 12 }} data-testid="graphql-schema-spec-name">
                    {binding.spec.name}
                  </Text>
                  <Tag style={{ margin: 0, fontSize: 11 }}>{SPEC_FORMAT_LABELS[binding.spec.format]}</Tag>
                  {binding.collection !== null && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('workbench.editors.request.spec.fromCollection', { name: binding.collection.name })}
                    </Text>
                  )}
                </>
              )}
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12, height: 'auto' }}
                onClick={onOpenSpecTab}
                data-testid="graphql-schema-spec-link"
              >
                {t('workbench.editors.graphql.schema.changeInSpecTab')}
              </Button>
            </div>
          )}
          {binding.kind === 'missing' && (
            <Text type="warning" style={{ fontSize: 11 }} data-testid="graphql-schema-spec-missing">
              {t('workbench.editors.graphql.schema.specMissing')}
            </Text>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.graphql.schema.or')}
        </Text>
        <Button size="small" onClick={onImportSchema} data-testid="graphql-schema-import">
          {t('workbench.editors.graphql.explorer.importSchema')}
        </Button>
      </div>

      {summary !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid="graphql-schema-summary">
          <Tag style={{ margin: 0, fontSize: 11 }}>
            {t('workbench.editors.graphql.schema.summaryTypes', { count: summary.count })}
          </Tag>
          {summary.roots.map((root) => (
            <Tag key={root} style={{ margin: 0, fontSize: 11, fontFamily: "'SF Mono', monospace" }}>
              {root}
            </Tag>
          ))}
        </div>
      )}
      {state.problems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="graphql-schema-problems">
          <Text type="warning" style={{ fontSize: 11 }}>
            {t('workbench.editors.graphql.schema.problems', { count: state.problems.length })}
          </Text>
          {state.problems.slice(0, 8).map((problem) => (
            <Text key={problem} type="secondary" style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>
              {problem}
            </Text>
          ))}
        </div>
      )}

      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.graphql.schema.hint')}
      </Text>
    </div>
  );
};

export default GraphqlSchemaTab;
