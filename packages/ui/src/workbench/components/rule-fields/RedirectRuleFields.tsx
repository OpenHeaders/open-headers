/**
 * RedirectRuleFields — redirect target configuration.
 */

import { Form, Radio, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import { getDocId } from '../docs/doc-ids';
import DocInfo from '../shared/DocInfo';
import SectionInfo from '../shared/SectionInfo';
import { DetectedValueInput } from '../value-editors';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

const RedirectRuleFields: React.FC = () => {
  const t = useT();
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.editors.rule.fields.actionsTitle')}
        </Text>
        <SectionInfo
          content={{
            kicker: t('workbench.editors.rule.fields.redirect.kicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: t('workbench.editors.rule.fields.redirect.infoSummary'),
            description: t('workbench.editors.rule.fields.redirect.infoDescription'),
          }}
          docId={getDocId('redirect', 'action')}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.rule.fields.redirect.redirectsTo')}
        </Text>
        <DocInfo docId={getDocId('redirect-regex', 'action')} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <Radio.Group value="url" size="small">
          <Radio.Button value="url">{t('workbench.editors.rule.fields.redirect.anotherUrl')}</Radio.Button>
          <Tooltip title={t('workbench.editors.rule.fields.redirect.desktopOnly')}>
            <Radio.Button value="local" disabled>
              {t('workbench.editors.rule.fields.redirect.localFile')}
            </Radio.Button>
          </Tooltip>
        </Radio.Group>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <EntityField path={paths.redirectTo}>
          <Form.Item name="redirectTo" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <DetectedValueInput
              placeholder={t('workbench.editors.rule.fields.redirect.targetPlaceholder')}
              wrap
              maxRows={4}
              resizable
              allowClear
            />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="redirectTo" schemaPath={paths.redirectTo} />
      </div>
    </div>
  );
};

export default RedirectRuleFields;
