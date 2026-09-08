/**
 * GraphqlSpecTab — the GraphQL request's spec binding surface, the
 * family's Spec tab (last, behind the divider): the picker for the
 * request's own `graphql` spec link (a request inside a spec-generated
 * collection inherits the collection's link until it picks its own),
 * the linked spec named with its format, the collection it reads
 * through or was generated from, and the drift since that generation.
 * No Apply: the linked spec IS the request's schema source, and the
 * Query tab's builder already is the per-field comparison against it.
 */

import type { RequestSpecLink } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select, Tag, Typography } from 'antd';
import type React from 'react';
import SpecEmptyCta from '../shared/SpecEmptyCta';
import { SPEC_FORMAT_LABELS } from '../specs/spec-format-labels';
import type { GraphqlSpecBindingState } from './useGraphqlSpecBinding';

const { Text } = Typography;

interface GraphqlSpecTabProps {
  specs: GraphqlSpecBindingState;
  /** The request's OWN link — the picker's value (an inherited link leaves it empty). */
  specLink: RequestSpecLink | undefined;
  onSpecLinkChange: (specUid: string | undefined) => void;
}

const GraphqlSpecTab: React.FC<GraphqlSpecTabProps> = ({ specs, specLink, onSpecLinkChange }) => {
  const t = useT();
  const { binding, graphqlSpecs } = specs;
  const inheritedSpecName =
    binding.kind === 'linked' && binding.source === 'collection' ? binding.spec.name : null;

  const picker =
    graphqlSpecs.length === 0 ? (
      <SpecEmptyCta format={SPEC_FORMAT_LABELS.graphql} testid="graphql-spec-empty" />
    ) : (
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.graphql.spec.selectLabel')}
        </Text>
        <Select
          style={{ width: '100%' }}
          allowClear
          placeholder={
            inheritedSpecName !== null
              ? t('workbench.editors.request.spec.inheritedPlaceholder', { name: inheritedSpecName })
              : t('workbench.editors.graphql.spec.selectPlaceholder')
          }
          // null, not undefined — an undefined value flips the antd
          // Select to uncontrolled.
          value={specLink?.specUid ?? null}
          options={graphqlSpecs.map((spec) => ({ value: spec.uid, label: spec.name }))}
          onChange={(specUid: string | undefined) => onSpecLinkChange(specUid)}
          data-testid="graphql-spec-select"
        />
      </div>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }} data-testid="graphql-spec-tab">
      {picker}
      {binding.kind === 'unlinked' && graphqlSpecs.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.graphql.spec.none')}
        </Text>
      )}
      {binding.kind === 'linked' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 12 }} data-testid="graphql-spec-name">
            {binding.spec.name}
          </Text>
          <Tag style={{ margin: 0, fontSize: 11 }}>{SPEC_FORMAT_LABELS[binding.spec.format]}</Tag>
          {binding.collection !== null && (
            <Text type="secondary" style={{ fontSize: 11 }} data-testid="graphql-spec-from-collection">
              {t('workbench.editors.request.spec.fromCollection', { name: binding.collection.name })}
            </Text>
          )}
        </div>
      )}
      {binding.kind === 'missing' && (
        <Text type="warning" style={{ fontSize: 11 }} data-testid="graphql-spec-missing">
          {t('workbench.editors.graphql.schema.specMissing')}
        </Text>
      )}
      {binding.kind === 'linked' && binding.drifted === true && (
        <Text type="warning" style={{ fontSize: 11 }} data-testid="graphql-spec-drifted">
          {t('workbench.editors.request.spec.drifted')}
        </Text>
      )}
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.graphql.spec.hint')}
      </Text>
    </div>
  );
};

export default GraphqlSpecTab;
