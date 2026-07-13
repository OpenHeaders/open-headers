/**
 * BlockRuleFields — info panel for block rules.
 * Block rules only need conditions — no action configuration.
 */

import { StopOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import SectionInfo from '../shared/SectionInfo';
import { getDocId } from '../docs/doc-ids';

const { Text } = Typography;

const BlockRuleFields: React.FC = () => {
  const t = useT();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.editors.rule.fields.actionsTitle')}
        </Text>
        <SectionInfo
          content={{
            kicker: t('workbench.editors.rule.fields.block.kicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: t('workbench.editors.rule.fields.block.infoSummary'),
            description: t('workbench.editors.rule.fields.block.infoDescription'),
          }}
          docId={getDocId('block', 'action')}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          background: 'var(--ant-color-fill-quaternary, #fafafa)',
        }}
      >
        <StopOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 16, marginTop: 2 }} />
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 2 }}>
            {t('workbench.editors.rule.fields.block.title')}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {t('workbench.editors.rule.fields.block.body')}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default BlockRuleFields;
