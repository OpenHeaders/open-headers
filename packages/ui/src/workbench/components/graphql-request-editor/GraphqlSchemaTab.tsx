/**
 * GraphqlSchemaTab — the schema plane's shell: the source picker over
 * the three ratified sources (introspection through the compile, a
 * linked `graphql` Spec, an imported SDL / introspection file), every
 * one present and disabled-honest until the schema plane lands. A
 * visible affordance that names its slice, never a hidden button (the
 * CTA-scaffold law).
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Select, Tooltip, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const GraphqlSchemaTab: React.FC = () => {
  const t = useT();
  const pending = t('workbench.editors.graphql.explorer.landsWithSchema');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }} data-testid="graphql-schema-tab">
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.graphql.schema.sourceLabel')}
        </Text>
        <Tooltip title={pending}>
          <Select
            style={{ width: '100%' }}
            placeholder={t('workbench.editors.graphql.schema.sourcePlaceholder')}
            disabled
            options={[]}
            data-testid="graphql-schema-source"
          />
        </Tooltip>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Tooltip title={pending}>
          <span style={{ display: 'inline-flex' }}>
            <Button size="small" disabled data-testid="graphql-schema-introspect">
              {t('workbench.editors.graphql.explorer.introspect')}
            </Button>
          </span>
        </Tooltip>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.graphql.schema.or')}
        </Text>
        <Tooltip title={pending}>
          <span style={{ display: 'inline-flex' }}>
            <Button size="small" disabled data-testid="graphql-schema-import">
              {t('workbench.editors.graphql.explorer.importSchema')}
            </Button>
          </span>
        </Tooltip>
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.graphql.schema.hint')}
      </Text>
    </div>
  );
};

export default GraphqlSchemaTab;
