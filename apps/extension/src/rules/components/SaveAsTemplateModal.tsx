/**
 * SaveAsTemplateModal — "Save as Template" modal triggered from RuleEditor.
 *
 * Step 1: Template metadata (name, icon, description, include toggles)
 * Step 2: Pick collection + folder (reuses SaveToCollectionModal pattern)
 */

import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { Checkbox, Form, Input, Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import SaveToCollectionModal from './SaveToCollectionModal';

const { Text } = Typography;
const { TextArea } = Input;

const DEFAULT_EMOJI: Record<string, string> = {
  header: '📋',
  block: '🛡️',
  redirect: '↪️',
  'query-param': '🔗',
  inject: '💉',
  delay: '⏱️',
  body: '📝',
  mock: '✅',
};

const RULE_TYPE_LABEL: Record<string, string> = {
  header: 'Header',
  block: 'Block',
  redirect: 'Redirect',
  'query-param': 'Query Param',
  inject: 'Inject',
  delay: 'Delay',
  body: 'Body',
  mock: 'API Response',
};

interface SaveAsTemplateModalProps {
  open: boolean;
  ruleType: string;
  conditions: V5.RuleCondition[];
  formValues: Record<string, unknown>;
  onCancel: () => void;
  onSaved?: (template: V5.Template) => void;
}

const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({
  open,
  ruleType,
  conditions,
  formValues,
  onCancel,
  onSaved,
}) => {
  const { token } = theme.useToken();
  const {
    templateCollectionTrees,
    templateCollections,
    createTemplate,
    createTemplateCollection,
    createTemplateFolder,
  } = useRules();

  const [step, setStep] = useState<'metadata' | 'collection'>('metadata');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [includeConditions, setIncludeConditions] = useState(true);
  const [includeFormValues, setIncludeFormValues] = useState(true);

  useEffect(() => {
    if (open) {
      setStep('metadata');
      setName('');
      setIcon(DEFAULT_EMOJI[ruleType] ?? '📋');
      setDescription('');
      setIncludeConditions(true);
      setIncludeFormValues(true);
    }
  }, [open, ruleType]);

  const handleMetadataNext = useCallback(() => {
    if (!name.trim()) return;
    setStep('collection');
  }, [name]);

  const handleCollectionSave = useCallback(
    async (params: { name: string; collectionId: string; folderPath?: string }) => {
      const templateData: Omit<V5.Template, 'uid' | 'path'> = {
        name: params.name,
        ruleType: ruleType as V5.RuleType,
        icon: icon || (DEFAULT_EMOJI[ruleType] ?? '📋'),
        description,
        includes: { conditions: includeConditions, formValues: includeFormValues },
        conditions: includeConditions ? conditions : [],
        formValues: includeFormValues ? formValues : {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await createTemplate(templateData, params.collectionId, params.folderPath);
      if (created) {
        onSaved?.(created);
      }
      onCancel();
    },
    [
      ruleType,
      icon,
      description,
      includeConditions,
      includeFormValues,
      conditions,
      formValues,
      createTemplate,
      onSaved,
      onCancel,
    ],
  );

  if (step === 'collection') {
    return (
      <SaveToCollectionModal
        open={open}
        entityName={name}
        collectionTrees={templateCollectionTrees}
        collections={templateCollections}
        onSave={(params) => void handleCollectionSave(params)}
        onCreateCollection={createTemplateCollection}
        onCreateFolder={createTemplateFolder}
        onCancel={() => setStep('metadata')}
      />
    );
  }

  return (
    <Modal
      open={open}
      title="Save as Template"
      okText="Next"
      cancelText="Cancel"
      onOk={handleMetadataNext}
      onCancel={onCancel}
      okButtonProps={{ disabled: !name.trim() }}
      width={440}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Save the current {RULE_TYPE_LABEL[ruleType] ?? 'Rule'} configuration as a reusable template.
        </Text>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 60 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            Icon
          </Text>
          <Input
            size="small"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="📋"
            style={{ textAlign: 'center' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            Name *
          </Text>
          <Input
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My template name"
            autoFocus
            onPressEnter={handleMetadataNext}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
          Description
        </Text>
        <TextArea
          size="small"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this template do? (optional)"
          autoSize={{ minRows: 1, maxRows: 3 }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '8px 12px',
          background: token.colorFillQuaternary,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <Checkbox checked={includeConditions} onChange={(e) => setIncludeConditions(e.target.checked)}>
          <Text style={{ fontSize: 12 }}>Include conditions</Text>
          {conditions.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
              ({conditions.length})
            </Text>
          )}
        </Checkbox>
        <Checkbox checked={includeFormValues} onChange={(e) => setIncludeFormValues(e.target.checked)}>
          <Text style={{ fontSize: 12 }}>Include form values</Text>
        </Checkbox>
      </div>
    </Modal>
  );
};

export default SaveAsTemplateModal;
