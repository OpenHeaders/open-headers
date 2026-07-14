/**
 * SaveAsTemplateModal — "Save as User Template" modal triggered from RuleEditor.
 *
 * Step 1: Template metadata (name, icon, description, include toggles)
 * Step 2: Pick collection + folder (reuses SaveToCollectionModal pattern)
 */

import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { NEW_TEMPLATE_COLLECTION_NAME } from '@openheaders/ui/shared/naming';
import type { RuleCondition, RuleType, Template } from '@openheaders/core/types';
import { Checkbox, Input, Modal, Typography, theme } from 'antd';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import SaveToCollectionModal from './SaveToCollectionModal';
import TwoToneIconPicker, { getDefaultIconForType } from '../shared/TwoToneIconPicker';

const { Text } = Typography;
const { TextArea } = Input;

const RULE_TYPE_LABEL_KEYS: Record<string, MessageKey> = {
  header: 'workbench.save.ruleType.header',
  block: 'workbench.save.ruleType.block',
  redirect: 'workbench.save.ruleType.redirect',
  'query-param': 'workbench.save.ruleType.queryParam',
  inject: 'workbench.save.ruleType.inject',
  delay: 'workbench.save.ruleType.delay',
  'request-body': 'workbench.save.ruleType.requestBody',
  response: 'workbench.save.ruleType.response',
};

interface SaveAsTemplateModalProps {
  open: boolean;
  ruleType: string;
  conditions: RuleCondition[];
  formValues: Record<string, unknown>;
  onCancel: () => void;
  onSaved?: (template: Template) => void;
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
  const t = useT();
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
      setIcon(getDefaultIconForType(ruleType));
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
      const templateData: Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'> = {
        name: params.name,
        ruleType: ruleType as RuleType,
        icon: icon || getDefaultIconForType(ruleType),
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
        defaultNewCollectionName={NEW_TEMPLATE_COLLECTION_NAME}
      />
    );
  }

  return (
    <Modal
      open={open}
      title={t('workbench.save.template.title')}
      okText={t('workbench.save.template.next')}
      cancelText={t('workbench.save.cancel')}
      onOk={handleMetadataNext}
      onCancel={onCancel}
      // Unmount on close so the icon picker's popover state can't go
      // stale — Esc closes the modal without an outside mousedown, and a
      // kept-mounted picker would reopen (or linger) on the next open.
      destroyOnHidden
      okButtonProps={{ disabled: !name.trim() }}
      width={440}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.save.template.intro', {
            type: RULE_TYPE_LABEL_KEYS[ruleType] ? t(RULE_TYPE_LABEL_KEYS[ruleType]) : t('workbench.save.template.ruleFallback'),
          })}
        </Text>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            {t('workbench.save.template.iconLabel')}
          </Text>
          <TwoToneIconPicker value={icon} onChange={setIcon} />
        </div>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            {t('workbench.save.template.nameLabel')}
          </Text>
          <Input
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('workbench.save.template.namePlaceholder')}
            autoFocus
            onPressEnter={handleMetadataNext}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
          {t('workbench.save.template.descriptionLabel')}
        </Text>
        <TextArea
          size="small"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('workbench.save.template.descriptionPlaceholder')}
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
          <Text style={{ fontSize: 12 }}>{t('workbench.save.template.includeConditions')}</Text>
          {conditions.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
              ({conditions.length})
            </Text>
          )}
        </Checkbox>
        <Checkbox checked={includeFormValues} onChange={(e) => setIncludeFormValues(e.target.checked)}>
          <Text style={{ fontSize: 12 }}>{t('workbench.save.template.includeActions')}</Text>
          {(() => {
            // Count non-empty action fields
            const reqH = formValues.requestHeaders as unknown[] | undefined;
            const resH = formValues.responseHeaders as unknown[] | undefined;
            const qp = formValues.queryParams as unknown[] | undefined;
            const count = (reqH?.length ?? 0) + (resH?.length ?? 0) + (qp?.length ?? 0);
            // For non-array types, check if any meaningful value exists
            const hasScalar = !!(
              formValues.redirectTo ||
              formValues.delayMs ||
              formValues.injectCode ||
              formValues.responseStaticBody ||
              formValues.responseDynamicBody ||
              formValues.requestStaticBody ||
              formValues.requestDynamicBody
            );
            const total = count || (hasScalar ? 1 : 0);
            return total > 0 ? (
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                ({total})
              </Text>
            ) : null;
          })()}
        </Checkbox>
      </div>
    </Modal>
  );
};

export default SaveAsTemplateModal;
