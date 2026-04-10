/**
 * HeaderRuleFields — multiple request + response header modifications.
 *
 * Maps 1:1 to Chrome's modifyHeaders DNR action. Two tabs:
 *   Request Headers — modifications to outgoing headers
 *   Response Headers — modifications to incoming headers
 *
 * Both tabs are ALWAYS mounted (destroyInactiveTabPane=false) so form.setFieldsValue
 * works regardless of which tab is visible. Auto-navigates to the tab with content.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Form, Input, Select, Tabs, Typography } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

const { Text } = Typography;

const OPERATIONS = [
  { value: 'override', label: 'Set' },
  { value: 'add', label: 'Append' },
  { value: 'remove', label: 'Remove' },
];

function ModificationList({ name }: { name: string }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <div key={field.key} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <Form.Item
                {...field}
                name={[field.name, 'operation']}
                style={{ marginBottom: 0, width: 110, flexShrink: 0 }}
              >
                <Select size="small" options={OPERATIONS} />
              </Form.Item>
              <Form.Item {...field} name={[field.name, 'headerName']} style={{ marginBottom: 0, flex: 1 }}>
                <Input size="small" placeholder="Header Name" />
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
                  return (
                    <Form.Item {...field} name={[field.name, 'value']} style={{ marginBottom: 0, flex: 1 }}>
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
          ))}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => add({ operation: 'override', headerName: '', value: '' })}
          >
            Add Modification
          </Button>
        </>
      )}
    </Form.List>
  );
}

const HeaderRuleFields: React.FC = () => {
  const [activeTab, setActiveTab] = useState('request');
  const reqHeaders = Form.useWatch('requestHeaders') as unknown[] | undefined;
  const resHeaders = Form.useWatch('responseHeaders') as unknown[] | undefined;
  const reqCount = reqHeaders?.length ?? 0;
  const resCount = resHeaders?.length ?? 0;
  const hasResponse = resCount > 0;

  // Auto-navigate to the tab with content when data changes (e.g. template applied)
  const prevReqCount = useRef(reqCount);
  const prevResCount = useRef(resCount);
  useEffect(() => {
    const reqGrew = reqCount > prevReqCount.current;
    const resGrew = resCount > prevResCount.current;
    prevReqCount.current = reqCount;
    prevResCount.current = resCount;

    // Switch to the tab that just got content
    if (resGrew && !reqGrew && resCount > 0) {
      setActiveTab('response');
    } else if (reqGrew && !resGrew && reqCount > 0) {
      setActiveTab('request');
    }
  }, [reqCount, resCount]);

  return (
    <div style={{ marginBottom: 16 }}>
      {hasResponse && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12, fontSize: 12 }}
          message="Response header modifications are not visible in the browser DevTools Network tab, but they are actually applied. The browser shows the original server headers."
        />
      )}
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={setActiveTab}
        destroyInactiveTabPane={false}
        items={[
          {
            key: 'request',
            label: (
              <span>
                Request Headers {reqCount > 0 && <Badge count={reqCount} size="small" style={{ marginLeft: 4 }} />}
              </span>
            ),
            children: <ModificationList name="requestHeaders" />,
          },
          {
            key: 'response',
            label: (
              <span>
                Response Headers {resCount > 0 && <Badge count={resCount} size="small" style={{ marginLeft: 4 }} />}
              </span>
            ),
            children: <ModificationList name="responseHeaders" />,
          },
        ]}
      />
    </div>
  );
};

export default HeaderRuleFields;
