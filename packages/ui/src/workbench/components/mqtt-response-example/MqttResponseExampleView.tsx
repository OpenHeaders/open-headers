/**
 * MqttResponseExampleView — editor tab for a saved MQTT response
 * example, the `WsResponseExampleView` sibling for the MqttRequest
 * family. The captured request half stays editable (an example doubles
 * as an authored record): version chip + URL in the header (the
 * version knob is the capture's fact — a static chip, never a select),
 * Message / Topics compose tabs below. The captured session half
 * renders read-only through `MqttExampleResultPane` in the
 * compose/result Allotment split.
 *
 * "Open in Request" hands the current captured request shape to the
 * parent MQTT editor as unsaved draft edits via the prefill bus — the
 * gRPC example's flow applied to the fourth family.
 *
 * Editor mechanics follow the house recipe: draft state, structural
 * dirty via `useReprime` (collapsed-capture fingerprints), Save through
 * the MQTT response-example write client (the captured block patches
 * as one LWW value), shell wiring via `useEditorShell`.
 */

import { ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type {
  MqttPayloadFormat,
  MqttRequestQos,
  MqttResponseExample,
  MqttTopicRow,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Allotment } from 'allotment';
import { App, Button, Checkbox, Input, Segmented, Select, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useMqttResponseExample } from '@openheaders/ui/shared/hooks/readers/useMqttResponseExamples';
import { applyMqttResponseExampleUpdate } from '@openheaders/ui/shared/sync/mqtt-response-example-write-client';
import type { LanguageId } from '@openheaders/ui/workbench/languages/registry';
import EditorHeader from '../shell/EditorHeader';
import CodeEditor from '../shared/CodeEditor';
import { EditableGridTable } from '../request-editor/EditableGridTable';
import type { EditableRowAdapter } from '../request-editor/editable-grid-types';
import { publishMqttPrefill } from '../mqtt-request-editor/mqtt-prefill-bus';
import MqttExampleResultPane from './MqttExampleResultPane';
import {
  capturedMqttRequestFromDraft,
  type MqttExampleDraft,
  mqttExampleDraftFingerprint,
  mqttExampleSignature,
  mqttExampleToDraft,
} from './mqtt-example-draft';

const { Text } = Typography;

/** Monaco language per compose ENCODING — base64/hex author plain text. */
const PAYLOAD_FORMAT_LANGUAGE = {
  text: 'text',
  json: 'json',
  base64: 'text',
  hex: 'text',
} as const satisfies Record<MqttPayloadFormat, LanguageId>;

/** Topics-grid row adapter — the topic filter rides the key track;
 *  QoS + Subscribe live in the value cell (the capture keeps the 5.0
 *  per-row options verbatim without a popover of their own). */
const TOPIC_ROW_ADAPTER: EditableRowAdapter<MqttTopicRow> = {
  getId: (r) => r.uid,
  getEnabled: () => true,
  setEnabled: (r) => r,
  getKey: (r) => r.topicFilter,
  setKey: (r, v) => ({ ...r, topicFilter: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => ({ uid: generateUid(), topicFilter: '' }),
  isEmpty: (r) => !r.topicFilter && !r.description,
};

const QOS_OPTIONS = (t: Translate) => [
  { value: 0, label: t('workbench.editors.mqtt.qos.q0') },
  { value: 1, label: t('workbench.editors.mqtt.qos.q1') },
  { value: 2, label: t('workbench.editors.mqtt.qos.q2') },
];

interface MqttResponseExampleViewProps {
  exampleUid: string;
  workspaceId: string | null;
  /** "Open in Request" — open the parent MQTT request's edit tab; the
   *  captured shape rides the prefill bus into its draft. */
  onOpenMqttRequest: (uid: string, name: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const MqttResponseExampleView: React.FC<MqttResponseExampleViewProps> = ({
  exampleUid,
  workspaceId,
  onOpenMqttRequest,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { example, hydrated } = useMqttResponseExample(workspaceId, exampleUid);
  const { mqttRequests } = useRequests();

  const parentRequest = useMemo(
    () => (example ? (mqttRequests.find((r) => r.uid === example.mqttRequestUid) ?? null) : null),
    [mqttRequests, example],
  );

  const [draft, setDraft] = useState<MqttExampleDraft | null>(null);
  const [activeTab, setActiveTab] = useState('message');

  const reprime = useReprime<MqttResponseExample>({
    liveEntity: example,
    scope: { entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: exampleUid },
    enabled: hydrated,
    formFingerprint: draft ? mqttExampleDraftFingerprint(draft) : '',
    signature: mqttExampleSignature,
    populate: (e) => setDraft(mqttExampleToDraft(e)),
  });
  const isDirty = reprime.isDirty;

  const handleSave = useCallback(async () => {
    if (!draft || !example || !workspaceId || !isDirty) return;
    const result = await applyMqttResponseExampleUpdate(
      exampleUid,
      { request: capturedMqttRequestFromDraft(draft) },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (!result.ok) {
      if (result.reason === 'not-found') message.error(t('workbench.editors.mqttExample.toast.deletedOtherTab'));
      else if ('message' in result && result.message)
        message.error(t('workbench.editors.mqttExample.toast.saveFailedDetail', { message: result.message }));
      else message.error(t('workbench.editors.mqttExample.toast.saveFailed'));
    }
  }, [draft, example, workspaceId, isDirty, exampleUid, message, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
    entityId: example?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const handleOpenInRequest = useCallback(() => {
    if (!draft || !example || !parentRequest) return;
    publishMqttPrefill(parentRequest.uid, capturedMqttRequestFromDraft(draft));
    onOpenMqttRequest(parentRequest.uid, parentRequest.name);
  }, [draft, example, parentRequest, onOpenMqttRequest]);

  if (!hydrated || (example && !draft)) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          {t('workbench.editors.mqttExample.loading')}
        </Text>
      </div>
    );
  }

  if (!example || !draft) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('workbench.editors.mqttExample.notFound')}</Text>
      </div>
    );
  }

  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      {/* The version knob is the capture's fact — a static chip. */}
      <Tag style={{ marginInlineEnd: 0, flexShrink: 0, fontSize: 10 }}>
        {draft.protocolVersion === '3.1.1'
          ? t('workbench.editors.mqtt.version.v311')
          : t('workbench.editors.mqtt.version.v5')}
      </Tag>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.mqtt.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => (d ? { ...d, url: e.target.value } : d))}
        data-testid="mqtt-example-url-input"
      />
    </div>
  );

  const openDisabled = parentRequest === null;
  const headerActions = (
    <Tooltip
      title={
        openDisabled ? t('workbench.editors.mqtt.notFound') : t('workbench.editors.mqttExample.openInRequestTooltip')
      }
      placement="bottom"
    >
      <span style={{ display: 'inline-flex', cursor: openDisabled ? 'not-allowed' : undefined }}>
        <Button
          size="small"
          type="primary"
          icon={<ExportOutlined />}
          disabled={openDisabled}
          onClick={handleOpenInRequest}
          data-testid="mqtt-example-open-in-request"
        >
          {t('workbench.editors.mqttExample.openInRequest')}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
          height: '100%',
        }}
      >
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment vertical proportionalLayout separator>
            <Allotment.Pane minSize={180} preferredSize="45%">
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                <div style={{ padding: '0 12px' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="small"
                    tabBarStyle={{ marginBottom: 0 }}
                    items={[
                      { key: 'message', label: t('workbench.editors.mqtt.tab.message') },
                      { key: 'topics', label: t('workbench.editors.mqtt.tab.topics') },
                    ]}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    overscrollBehavior: 'none',
                    padding: '0 12px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '10px 0', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'message' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Input
                            size="small"
                            style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                            placeholder={t('workbench.editors.mqtt.topicPlaceholder')}
                            value={draft.topic}
                            onChange={(e) => setDraft((d) => (d ? { ...d, topic: e.target.value } : d))}
                            data-testid="mqtt-example-topic"
                          />
                          <Select
                            size="small"
                            style={{ width: 150 }}
                            value={draft.qos}
                            options={QOS_OPTIONS(t)}
                            onChange={(qos: MqttRequestQos) => setDraft((d) => (d ? { ...d, qos } : d))}
                          />
                          <Checkbox
                            checked={draft.retain}
                            onChange={(e) => setDraft((d) => (d ? { ...d, retain: e.target.checked } : d))}
                          >
                            {t('workbench.editors.mqtt.retainLabel')}
                          </Checkbox>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Segmented
                            size="small"
                            value={draft.payloadFormat}
                            onChange={(payloadFormat) =>
                              setDraft((d) => (d ? { ...d, payloadFormat: payloadFormat as MqttPayloadFormat } : d))
                            }
                            options={[
                              { value: 'text', label: t('workbench.editors.mqtt.payload.formatText') },
                              { value: 'json', label: t('workbench.editors.mqtt.payload.formatJson') },
                              { value: 'base64', label: t('workbench.editors.mqtt.payload.formatBase64') },
                              { value: 'hex', label: t('workbench.editors.mqtt.payload.formatHex') },
                            ]}
                          />
                        </div>
                        <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                          {/* Column direction — a fill editor sizes to
                            content as a row-flex child (the sliver
                            trap). */}
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                            <CodeEditor
                              value={draft.payload}
                              onChange={(payload) => setDraft((d) => (d ? { ...d, payload } : d))}
                              language={PAYLOAD_FORMAT_LANGUAGE[draft.payloadFormat]}
                              fill
                              placeholder={t('workbench.editors.mqtt.payloadPlaceholder')}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === 'topics' && (
                      <EditableGridTable<MqttTopicRow>
                        rows={draft.topics}
                        onChange={(topics) => setDraft((d) => (d ? { ...d, topics } : d))}
                        adapter={TOPIC_ROW_ADAPTER}
                        keyPlaceholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
                        headerLabels={{
                          key: t('workbench.editors.mqtt.topics.filterLabel'),
                          value: t('workbench.editors.mqtt.topics.optionsLabel'),
                        }}
                        hideEnabled
                        columnWidths={{ value: '150px' }}
                        renderValueCell={(row, update, ctx) =>
                          ctx.isPlaceholder ? (
                            <span />
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, paddingLeft: 4 }}>
                              <Select
                                size="small"
                                style={{ width: 74 }}
                                value={row.qos ?? 0}
                                options={[
                                  { value: 0, label: 'QoS 0' },
                                  { value: 1, label: 'QoS 1' },
                                  { value: 2, label: 'QoS 2' },
                                ]}
                                onChange={(qos: MqttRequestQos) => update({ ...row, qos })}
                              />
                            </span>
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={140}>
              <MqttExampleResultPane
                response={example.response}
                protocolVersion={example.request.protocolVersion}
                capturedAt={example.capturedAt}
              />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default MqttResponseExampleView;
