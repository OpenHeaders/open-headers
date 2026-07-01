/**
 * MessageRuleFields — shared form body for the WS and SSE rule editors.
 *
 * Both rule types share the operation / filter / payload / trigger
 * vocabulary; WS adds a direction selector, SSE adds an event-name
 * gate. The two thin exports (`WsRuleFields`, `SseRuleFields`) configure
 * this shared body with prefixed form-field names so they stay
 * unambiguous in the editor's single form-state object.
 *
 * Conditional blocks read trigger values via `Form.Item shouldUpdate`
 * render props (not `Form.useWatch`) — same first-render timing
 * rationale as RequestBodyRuleFields.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import CodeEditor from '../shared/CodeEditor';

const { Text } = Typography;

interface MessageRuleFieldsProps {
  kind: 'ws' | 'sse';
}

const FIELD = {
  ws: {
    operation: 'wsOperation',
    direction: 'wsDirection',
    filterType: 'wsFilterType',
    filterValue: 'wsFilterValue',
    payload: 'wsPayload',
    injectTrigger: 'wsInjectTrigger',
  },
  sse: {
    operation: 'sseOperation',
    eventName: 'sseEventName',
    filterType: 'sseFilterType',
    filterValue: 'sseFilterValue',
    payload: 'ssePayload',
    injectTrigger: 'sseInjectTrigger',
  },
} as const;

const INTRO = {
  ws: 'Intercepts page-created WebSocket connections whose socket URL matches the conditions. Frames are modified, injected, or dropped in the page before they reach page code (incoming) or the wire (outgoing).',
  sse: 'Intercepts page-created EventSource streams whose URL matches the conditions. Events are modified, injected, or dropped in the page before listeners see them.',
} as const;

const MessageRuleFields: React.FC<MessageRuleFieldsProps> = ({ kind }) => {
  const { openDocs } = useInspectorNav();
  const paths = useActionPaths();
  const f = FIELD[kind];
  const unit = kind === 'ws' ? 'frame' : 'event';

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs('execution')}
        />
      </div>
      <Alert type="info" showIcon style={{ marginBottom: 12, fontSize: 12 }} message={INTRO[kind]} />

      {/* Operation */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Operation
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EntityField path={paths.messageOperation}>
            <Form.Item name={f.operation} style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="modify">Replace</Radio.Button>
                <Radio.Button value="inject">Inject</Radio.Button>
                <Radio.Button value="drop">Drop</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </EntityField>
          <ScalarConflictChip formName={f.operation} schemaPath={paths.messageOperation} />
        </div>
      </div>

      {/* WS direction */}
      {kind === 'ws' && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            Direction
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EntityField path={paths.messageDirection}>
              <Form.Item name={FIELD.ws.direction} style={{ marginBottom: 0 }}>
                <Radio.Group>
                  <Radio value="receive">Incoming (server → page)</Radio>
                  <Radio value="send">Outgoing (page → server)</Radio>
                </Radio.Group>
              </Form.Item>
            </EntityField>
            <ScalarConflictChip formName={FIELD.ws.direction} schemaPath={paths.messageDirection} />
          </div>
        </div>
      )}

      {/* SSE event-name gate */}
      {kind === 'sse' && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            Event name
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EntityField path={paths.messageEventName}>
              <Form.Item name={FIELD.sse.eventName} style={{ marginBottom: 0, width: 260 }}>
                <Input size="small" placeholder="Empty = default message events" />
              </Form.Item>
            </EntityField>
            <ScalarConflictChip formName={FIELD.sse.eventName} schemaPath={paths.messageEventName} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Matches the stream's <code>event:</code> field
            </Text>
          </div>
        </div>
      )}

      {/* Content filter */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          {kind === 'ws' ? 'Frame filter' : 'Data filter'}
        </Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <EntityField path={paths.messageFilterType}>
            <Form.Item name={f.filterType} style={{ marginBottom: 0, width: 140 }}>
              <Select
                size="small"
                options={[
                  { value: 'none', label: `Every ${unit}` },
                  { value: 'contains', label: 'Contains' },
                  { value: 'regex', label: 'Regex' },
                ]}
              />
            </Form.Item>
          </EntityField>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev[f.filterType] !== cur[f.filterType]}>
            {({ getFieldValue }) => {
              const filterType = getFieldValue(f.filterType);
              if (filterType !== 'contains' && filterType !== 'regex') return null;
              return (
                <>
                  <EntityField path={paths.messageFilterValue}>
                    <Form.Item name={f.filterValue} style={{ marginBottom: 0, flex: 1 }}>
                      <Input
                        size="small"
                        placeholder={filterType === 'regex' ? 'e.g. "type":\\s*"heartbeat"' : 'e.g. heartbeat'}
                      />
                    </Form.Item>
                  </EntityField>
                  <ScalarConflictChip formName={f.filterValue} schemaPath={paths.messageFilterValue} />
                </>
              );
            }}
          </Form.Item>
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Filters match text {unit}s only{kind === 'ws' ? ' — binary frames pass through when a filter is set' : ''}.
        </Text>
      </div>

      {/* Inject trigger + payload — both depend on the operation. */}
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev[f.operation] !== cur[f.operation]}>
        {({ getFieldValue }) => {
          const operation = getFieldValue(f.operation);
          return (
            <>
              {operation === 'inject' && (
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Inject when
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <EntityField path={paths.messageInjectTrigger}>
                      <Form.Item name={f.injectTrigger} style={{ marginBottom: 0 }}>
                        <Radio.Group>
                          <Radio value="open">{kind === 'ws' ? 'Connection opens' : 'Stream opens'}</Radio>
                          <Radio value="message">A matching {unit} arrives</Radio>
                        </Radio.Group>
                      </Form.Item>
                    </EntityField>
                    <ScalarConflictChip formName={f.injectTrigger} schemaPath={paths.messageInjectTrigger} />
                  </div>
                </div>
              )}
              {operation !== 'drop' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {operation === 'inject' ? `Injected ${unit}` : `Replacement ${unit}`}
                    </Text>
                    <ScalarConflictChip formName={f.payload} schemaPath={paths.messagePayload} />
                  </div>
                  <EntityField path={paths.messagePayload}>
                    <Form.Item name={f.payload} style={{ marginBottom: 0 }}>
                      <CodeEditor language="json" placeholder={'{"key": "value"}'} minHeight={120} />
                    </Form.Item>
                  </EntityField>
                </div>
              )}
            </>
          );
        }}
      </Form.Item>
    </div>
  );
};

export const WsRuleFields: React.FC = () => <MessageRuleFields kind="ws" />;
export const SseRuleFields: React.FC = () => <MessageRuleFields kind="sse" />;

export default MessageRuleFields;
