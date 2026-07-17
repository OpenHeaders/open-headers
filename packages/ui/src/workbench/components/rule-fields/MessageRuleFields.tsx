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

import { Alert, Form, Input, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';
import CodeEditor from '../shared/CodeEditor';
import SectionInfo from '../shared/SectionInfo';

const { Text } = Typography;

// JSON format example — raw by design across the rule editors.
const PAYLOAD_EXAMPLE = '{"key": "value"}';

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

const MessageRuleFields: React.FC<MessageRuleFieldsProps> = ({ kind }) => {
  const t = useT();
  const paths = useActionPaths();
  const f = FIELD[kind];
  const isWs = kind === 'ws';

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.editors.rule.fields.actionsTitle')}
        </Text>
        <SectionInfo
          content={{
            kicker: isWs
              ? t('workbench.editors.rule.fields.message.wsKicker')
              : t('workbench.editors.rule.fields.message.sseKicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: isWs
              ? t('workbench.editors.rule.fields.message.wsInfoSummary')
              : t('workbench.editors.rule.fields.message.sseInfoSummary'),
          }}
          docId="execution"
        />
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message={
          isWs ? t('workbench.editors.rule.fields.message.wsIntro') : t('workbench.editors.rule.fields.message.sseIntro')
        }
      />

      {/* Operation */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          {t('workbench.editors.rule.fields.message.operation')}
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EntityField path={paths.messageOperation}>
            <Form.Item name={f.operation} style={{ marginBottom: 0 }}>
              <Radio.Group size="small">
                <Radio.Button value="modify">{t('workbench.editors.rule.fields.message.opReplace')}</Radio.Button>
                <Radio.Button value="inject">{t('workbench.editors.rule.fields.message.opInject')}</Radio.Button>
                <Radio.Button value="drop">{t('workbench.editors.rule.fields.message.opDrop')}</Radio.Button>
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
            {t('workbench.editors.rule.fields.message.direction')}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EntityField path={paths.messageDirection}>
              <Form.Item name={FIELD.ws.direction} style={{ marginBottom: 0 }}>
                <Radio.Group>
                  <Radio value="receive">{t('workbench.editors.rule.fields.message.incoming')}</Radio>
                  <Radio value="send">{t('workbench.editors.rule.fields.message.outgoing')}</Radio>
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
            {t('workbench.editors.rule.fields.message.eventName')}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EntityField path={paths.messageEventName}>
              <Form.Item name={FIELD.sse.eventName} style={{ marginBottom: 0, width: 260 }}>
                <Input size="small" placeholder={t('workbench.editors.rule.fields.message.eventNamePlaceholder')} />
              </Form.Item>
            </EntityField>
            <ScalarConflictChip formName={FIELD.sse.eventName} schemaPath={paths.messageEventName} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.rule.fields.message.eventFieldNoteBefore')} <code>event:</code>{' '}
              {t('workbench.editors.rule.fields.message.eventFieldNoteAfter')}
            </Text>
          </div>
        </div>
      )}

      {/* Content filter */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          {isWs
            ? t('workbench.editors.rule.fields.message.frameFilter')
            : t('workbench.editors.rule.fields.message.dataFilter')}
        </Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <EntityField path={paths.messageFilterType}>
            <Form.Item name={f.filterType} style={{ marginBottom: 0, width: 140 }}>
              <Select
                size="small"
                options={[
                  {
                    value: 'none',
                    label: isWs
                      ? t('workbench.editors.rule.fields.message.everyFrame')
                      : t('workbench.editors.rule.fields.message.everyEvent'),
                  },
                  { value: 'contains', label: t('workbench.editors.rule.fields.operatorContains') },
                  { value: 'regex', label: t('workbench.editors.rule.fields.message.filterRegex') },
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
          {isWs
            ? t('workbench.editors.rule.fields.message.filterNoteWs')
            : t('workbench.editors.rule.fields.message.filterNoteSse')}
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
                    {t('workbench.editors.rule.fields.message.injectWhen')}
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <EntityField path={paths.messageInjectTrigger}>
                      <Form.Item name={f.injectTrigger} style={{ marginBottom: 0 }}>
                        <Radio.Group>
                          <Radio value="open">
                            {isWs
                              ? t('workbench.editors.rule.fields.message.connectionOpens')
                              : t('workbench.editors.rule.fields.message.streamOpens')}
                          </Radio>
                          <Radio value="message">
                            {isWs
                              ? t('workbench.editors.rule.fields.message.matchingFrameArrives')
                              : t('workbench.editors.rule.fields.message.matchingEventArrives')}
                          </Radio>
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
                      {operation === 'inject'
                        ? isWs
                          ? t('workbench.editors.rule.fields.message.injectedFrame')
                          : t('workbench.editors.rule.fields.message.injectedEvent')
                        : isWs
                          ? t('workbench.editors.rule.fields.message.replacementFrame')
                          : t('workbench.editors.rule.fields.message.replacementEvent')}
                    </Text>
                    <ScalarConflictChip formName={f.payload} schemaPath={paths.messagePayload} />
                  </div>
                  <EntityField path={paths.messagePayload}>
                    <Form.Item name={f.payload} style={{ marginBottom: 0 }}>
                      <CodeEditor language="json" placeholder={PAYLOAD_EXAMPLE} minHeight={120} />
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
