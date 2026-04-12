/**
 * HeaderRuleFields — multiple request + response header actions.
 *
 * Maps 1:1 to Chrome's modifyHeaders DNR action. Two tabs:
 *   Request Headers — actions to outgoing headers
 *   Response Headers — actions to incoming headers
 *
 * Both tabs are ALWAYS mounted (destroyInactiveTabPane=false) so form.setFieldsValue
 * works regardless of which tab is visible. Auto-navigates to the tab with content.
 *
 * Header-name input is an AutoComplete driven by
 * `getHeaderSuggestions(direction, operation)` from `@openheaders/core/utils` —
 * the same canonical table the DNR compiler uses. Each row runs the
 * capability check live: if the user authors an invalid combination
 * (e.g. `Append` on `X-Custom-Header`, which Chrome's DNR rejects), the
 * row shows an inline warning and the rule becomes a draft via
 * `isRuleComplete` so it can never leave stale DNR rules behind.
 */

import { CloseOutlined, InfoCircleOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import type { HeaderDirection } from '@openheaders/core/utils';
import { getHeaderOperationCapability, getHeaderSuggestions } from '@openheaders/core/utils';
import { Alert, AutoComplete, Badge, Button, Form, Input, Select, Tabs, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../InspectorDocs';

const { Text } = Typography;

const OPERATIONS = [
  { value: 'override', label: 'Override' },
  { value: 'add', label: 'Append' },
  { value: 'remove', label: 'Remove' },
  { value: 'merge', label: 'Merge' },
];

type HeaderOp = 'override' | 'add' | 'remove' | 'merge';

interface ModificationListProps {
  /** Form.List parent field name — 'requestHeaders' or 'responseHeaders'. */
  name: 'requestHeaders' | 'responseHeaders';
  direction: HeaderDirection;
}

function ModificationList({ name, direction }: ModificationListProps) {
  const { openDocs: openDocsInline } = useInspectorNav();
  const form = Form.useFormInstance();
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Form.Item
                  {...field}
                  name={[field.name, 'operation']}
                  style={{ marginBottom: 0, width: 110, flexShrink: 0 }}
                >
                  <Select size="small" options={OPERATIONS} />
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) =>
                    prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation
                  }
                >
                  {({ getFieldValue }) => {
                    const op = (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ?? 'override';
                    return (
                      <InfoCircleOutlined
                        style={{
                          fontSize: 10,
                          color: 'var(--ant-color-text-quaternary)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        onClick={() => openDocsInline(getDocId(op, 'action'))}
                      />
                    );
                  }}
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) =>
                    prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation ||
                    prev[name]?.[field.name]?.headerName !== cur[name]?.[field.name]?.headerName
                  }
                >
                  {({ getFieldValue }) => {
                    const op = (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ?? 'override';
                    const headerName = (getFieldValue([name, field.name, 'headerName']) as string | undefined) ?? '';
                    const suggestions = getHeaderSuggestions(direction, op).map((h) => ({ value: h, label: h }));
                    const capability = getHeaderOperationCapability(direction, op, headerName);
                    const showWarning = !capability.allowed;
                    return (
                      <Form.Item
                        {...field}
                        name={[field.name, 'headerName']}
                        style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                        validateStatus={showWarning ? 'warning' : undefined}
                      >
                        <AutoComplete
                          size="small"
                          placeholder="Header Name"
                          options={suggestions}
                          filterOption={(input, option) =>
                            (option?.value ?? '').toString().toLowerCase().includes(input.toLowerCase())
                          }
                          allowClear
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) => {
                    const prevOp = prev[name]?.[field.name]?.operation;
                    const curOp = cur[name]?.[field.name]?.operation;
                    return prevOp !== curOp;
                  }}
                >
                  {({ getFieldValue }) => {
                    const op = getFieldValue([name, field.name, 'operation']);
                    if (op === 'remove') return null;
                    if (op === 'merge') {
                      return (
                        <>
                          <Input
                            size="small"
                            disabled
                            value="existing value"
                            style={{ marginBottom: 0, width: 105, flexShrink: 0, fontStyle: 'italic', opacity: 0.5 }}
                          />
                          <Form.Item
                            {...field}
                            name={[field.name, 'mergeSeparator']}
                            style={{ marginBottom: 0, width: 50, flexShrink: 0 }}
                          >
                            <Input
                              size="small"
                              placeholder="; "
                              style={{ textAlign: 'center', fontFamily: 'monospace' }}
                            />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            name={[field.name, 'value']}
                            style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                          >
                            <Input size="small" placeholder="Value to append" />
                          </Form.Item>
                        </>
                      );
                    }
                    return (
                      <Form.Item
                        {...field}
                        name={[field.name, 'value']}
                        style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                      >
                        <Input size="small" placeholder="Header Value" />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined style={{ fontSize: 10 }} />}
                  onClick={() => remove(field.name)}
                  style={{ color: 'var(--ant-color-text-tertiary)', flexShrink: 0 }}
                />
              </div>
              {/* Inline capability warning — separate row so long reasons wrap cleanly. */}
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) =>
                  prev[name]?.[field.name]?.operation !== cur[name]?.[field.name]?.operation ||
                  prev[name]?.[field.name]?.headerName !== cur[name]?.[field.name]?.headerName
                }
              >
                {({ getFieldValue }) => {
                  const op = (getFieldValue([name, field.name, 'operation']) as HeaderOp | undefined) ?? 'override';
                  const headerName = (getFieldValue([name, field.name, 'headerName']) as string | undefined) ?? '';
                  const capability = getHeaderOperationCapability(direction, op, headerName);
                  if (capability.allowed) return null;
                  const switchToSuggested = () => {
                    if (!capability.suggestion) return;
                    form.setFieldValue([name, field.name, 'operation'], capability.suggestion);
                  };
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                        marginLeft: 132,
                        marginTop: 2,
                        fontSize: 11,
                        color: 'var(--ant-color-warning)',
                        lineHeight: 1.4,
                      }}
                    >
                      <WarningOutlined style={{ fontSize: 11, marginTop: 2 }} />
                      <span style={{ flex: 1 }}>
                        {capability.reason}
                        {capability.suggestion && (
                          <>
                            {' '}
                            <Button
                              type="link"
                              size="small"
                              onClick={switchToSuggested}
                              style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            >
                              Switch to {capability.suggestion === 'override' ? 'Override' : capability.suggestion}
                            </Button>
                          </>
                        )}
                      </span>
                    </div>
                  );
                }}
              </Form.Item>
            </div>
          ))}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => add({ operation: 'override', headerName: '', value: '' })}
          >
            Add Action
          </Button>
        </>
      )}
    </Form.List>
  );
}

interface HeaderRuleFieldsProps {
  /** Controlled active tab — parent (RuleEditor) owns this state. */
  activeTab: string;
  /** Tab change callback — parent updates state on user click. */
  onTabChange: (tab: string) => void;
  /** Request header count — parent (RuleEditor) owns this to avoid useWatch timing issues. */
  reqCount: number;
  /** Response header count — parent (RuleEditor) owns this to avoid useWatch timing issues. */
  resCount: number;
}

const HeaderRuleFields: React.FC<HeaderRuleFieldsProps> = ({ activeTab, onTabChange, reqCount, resCount }) => {
  const { openDocs } = useInspectorNav();
  const hasResponse = resCount > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      {hasResponse && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12, fontSize: 12 }}
          message="Response header actions are not visible in the browser DevTools Network tab, but they are actually applied. The browser shows the original server headers."
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <Tooltip title="Invalid combinations (e.g. Append on a custom header) mark the rule as a draft. Drafts are saved but not executed.">
          <InfoCircleOutlined
            style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
            onClick={() => openDocs('actions')}
          />
        </Tooltip>
      </div>
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={onTabChange}
        destroyInactiveTabPane={false}
        items={[
          {
            key: 'request',
            label: (
              <span>
                Request Headers {reqCount > 0 && <Badge count={reqCount} size="small" style={{ marginLeft: 4 }} />}
              </span>
            ),
            children: <ModificationList name="requestHeaders" direction="request" />,
          },
          {
            key: 'response',
            label: (
              <span>
                Response Headers {resCount > 0 && <Badge count={resCount} size="small" style={{ marginLeft: 4 }} />}
              </span>
            ),
            children: <ModificationList name="responseHeaders" direction="response" />,
          },
        ]}
      />
    </div>
  );
};

export default HeaderRuleFields;
