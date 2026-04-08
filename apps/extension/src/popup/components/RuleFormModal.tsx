/**
 * RuleFormModal — create/edit header rules in the extension popup.
 *
 * Used for standalone local rules (no desktop app needed).
 * Rules belong to a collection (matching the desktop workspace model).
 * Supports: collection, header name, value, domains, operation (add/override/remove),
 * request vs response, enabled/disabled, tag.
 */

import type { V5 } from '@openheaders/core/types';
import { useHeader } from '@hooks/useHeader';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Divider, Form, Input, Modal, Radio, Select, Space, Switch, Tag, Typography } from 'antd';
import type { InputRef } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

const { Text } = Typography;

interface RuleFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, the modal is in edit mode for this rule. */
  editRule?: V5.HeaderRule | null;
}

interface RuleFormValues {
  collectionUid: string;
  headerName: string;
  staticValue: string;
  domains: string;
  operation: V5.HeaderOperation;
  isResponse: boolean;
  enabled: boolean;
  tag: string;
}

const RuleFormModal: React.FC<RuleFormModalProps> = ({ open, onClose, editRule }) => {
  const { message } = App.useApp();
  const { createLocalRule, updateLocalRule, localCollections, createLocalCollection } = useHeader();
  const [form] = Form.useForm<RuleFormValues>();
  const [saving, setSaving] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const newCollectionInputRef = useRef<InputRef>(null);
  const isEdit = !!editRule;

  useEffect(() => {
    if (open) {
      if (editRule) {
        // Find collection uid from rule path: "rules/{collection-folder}/{rule-folder}"
        const pathParts = editRule.path.split('/');
        const collectionFolder = pathParts.length >= 2 ? pathParts[1] : '';
        const collectionUid = localCollections.find((c) => c.path === `rules/${collectionFolder}`)?.uid ?? '';

        form.setFieldsValue({
          collectionUid,
          headerName: editRule.action.headerName,
          staticValue: editRule.staticValue ?? '',
          domains: editRule.domains.join(', '),
          operation: editRule.action.operation,
          isResponse: editRule.action.isResponse,
          enabled: editRule.enabled,
          tag: editRule.tags[0] ?? '',
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          collectionUid: localCollections[0]?.uid ?? '',
          operation: 'override',
          isResponse: false,
          enabled: true,
          tag: '',
          staticValue: '',
          headerName: '',
          domains: '',
        });
      }
    }
  }, [open, editRule, form, localCollections]);

  const handleAddCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const collection = await createLocalCollection(name);
    if (collection) {
      form.setFieldsValue({ collectionUid: collection.uid });
      setNewCollectionName('');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const domains = values.domains
        .split(/[,\n]/)
        .map((d) => d.trim())
        .filter(Boolean);

      const tags = values.tag?.trim() ? [values.tag.trim()] : [];

      if (isEdit && editRule) {
        const success = await updateLocalRule(editRule.uid, {
          name: values.headerName,
          type: 'header',
          enabled: values.enabled,
          tags,
          domains,
          action: {
            operation: values.operation,
            headerName: values.headerName,
            isResponse: values.isResponse,
          },
          staticValue: values.operation === 'remove' ? undefined : values.staticValue,
        });
        if (success) {
          message.success('Rule updated');
          onClose();
        } else {
          message.error('Failed to update rule');
        }
      } else {
        const rule = await createLocalRule(
          {
            name: values.headerName,
            type: 'header',
            enabled: values.enabled,
            tags,
            domains,
            action: {
              operation: values.operation,
              headerName: values.headerName,
              isResponse: values.isResponse,
            },
            staticValue: values.operation === 'remove' ? undefined : values.staticValue,
          },
          values.collectionUid || undefined,
        );
        if (rule) {
          message.success('Rule created');
          onClose();
        } else {
          message.error('Failed to create rule');
        }
      }
    } catch (_e) {
      // Validation errors handled by antd
    } finally {
      setSaving(false);
    }
  };

  const operation = Form.useWatch('operation', form);

  return (
    <Modal
      title={
        <Space>
          <Text strong>{isEdit ? 'Edit Rule' : 'New Header Rule'}</Text>
          <Tag color="blue">Local</Tag>
        </Space>
      }
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={saving}
      okText={isEdit ? 'Save' : 'Create'}
      width={480}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        style={{ marginTop: 16 }}
      >
        {!isEdit && (
          <Form.Item
            name="collectionUid"
            label="Collection"
            extra="Rules are organized into collections, same as the desktop app"
          >
            <Select
              placeholder="Select or create a collection"
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="New collection name"
                      ref={newCollectionInputRef}
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      size="small"
                    />
                    <Button type="text" icon={<PlusOutlined />} onClick={handleAddCollection} size="small">
                      Add
                    </Button>
                  </Space>
                </>
              )}
              options={localCollections.map((c) => ({
                label: c.name,
                value: c.uid,
              }))}
            />
          </Form.Item>
        )}

        <Form.Item
          name="headerName"
          label="Header Name"
          rules={[{ required: true, message: 'Header name is required' }]}
        >
          <Input placeholder="e.g. Authorization, X-Custom-Header" autoFocus />
        </Form.Item>

        <Form.Item name="operation" label="Operation">
          <Radio.Group>
            <Radio.Button value="override">Override</Radio.Button>
            <Radio.Button value="add">Add</Radio.Button>
            <Radio.Button value="remove">Remove</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {operation !== 'remove' && (
          <Form.Item
            name="staticValue"
            label="Value"
            rules={[{ required: true, message: 'Value is required' }]}
          >
            <Input.TextArea
              placeholder="e.g. Bearer my-token"
              autoSize={{ minRows: 1, maxRows: 4 }}
            />
          </Form.Item>
        )}

        <Form.Item
          name="domains"
          label="Domains"
          rules={[{ required: true, message: 'At least one domain is required' }]}
          extra="Comma-separated. Wildcards supported: *.openheaders.io"
        >
          <Input.TextArea
            placeholder="e.g. *.openheaders.io, api.example.com"
            autoSize={{ minRows: 1, maxRows: 3 }}
          />
        </Form.Item>

        <Space size={24}>
          <Form.Item name="isResponse" label="Target" style={{ marginBottom: 8 }}>
            <Select style={{ width: 140 }}>
              <Select.Option value={false}>Request</Select.Option>
              <Select.Option value={true}>Response</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="enabled" label="Enabled" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Switch />
          </Form.Item>
        </Space>

        <Form.Item name="tag" label="Tag (optional)">
          <Input placeholder="e.g. dev, staging" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RuleFormModal;
