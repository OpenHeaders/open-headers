/**
 * MqttSavedMessagesRail — the Saved-messages rail beside the payload
 * editor: synced entity rows, not local state (they travel with the
 * workspace and git-sync). Clicking a row loads the compose;
 * Send-from-row publishes AS STORED while the session is open; rename/
 * duplicate/delete ride the row's ⋯ menu.
 *
 * COLLAPSIBLE (the git log's Branches-rail gesture, mirrored to the
 * right edge): hidden, the rail swaps for a narrow vertical strip
 * carrying a `<` chevron and the rotated title — the whole strip is
 * one button that brings the rail back. Editor-local display state.
 */

import { LeftOutlined, MoreOutlined, PlusOutlined, RightOutlined, SendOutlined } from '@ant-design/icons';
import type { MqttPublishWire } from '@openheaders/core/bridge';
import type { MqttSavedMessage } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Input, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { buildMqttRequestUpdates, type MqttDraft, propertiesToDraft } from './draft';

const { Text } = Typography;

interface MqttSavedMessagesRailProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  sessionOpen: boolean;
  onPublish: (message: MqttPublishWire) => void;
}

const MqttSavedMessagesRail: React.FC<MqttSavedMessagesRailProps> = ({ draft, setDraft, sessionOpen, onPublish }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [renamingSavedUid, setRenamingSavedUid] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [stripHovered, setStripHovered] = useState(false);

  const addSavedMessageFromCompose = () => {
    setDraft((d) => {
      const baseName = t('workbench.editors.mqtt.saved.defaultName');
      const names = new Set(d.savedMessages.map((m) => m.name));
      let name = baseName;
      let counter = 2;
      while (names.has(name)) name = `${baseName} (${counter++})`;
      const properties = buildMqttRequestUpdates(d).publishProperties;
      const row: MqttSavedMessage = {
        uid: generateUid(),
        name,
        topic: d.topic,
        payload: d.payload,
        ...(d.payloadFormat !== 'text' ? { format: d.payloadFormat } : {}),
        ...(d.qos !== 0 ? { qos: d.qos } : {}),
        ...(d.retain ? { retain: true } : {}),
        ...(properties !== undefined ? { properties } : {}),
      };
      return { ...d, savedMessages: [...d.savedMessages, row] };
    });
  };

  const loadSavedMessage = (row: MqttSavedMessage) => {
    setDraft((d) => ({
      ...d,
      topic: row.topic,
      payload: row.payload,
      payloadFormat: row.format ?? 'text',
      qos: row.qos ?? 0,
      retain: row.retain ?? false,
      publishProperties: propertiesToDraft(row.properties),
    }));
  };

  if (collapsed) {
    return (
      <Tooltip placement="left" title={t('workbench.editors.mqtt.saved.showRail')}>
        <button
          type="button"
          aria-label={t('workbench.editors.mqtt.saved.showRail')}
          onClick={() => setCollapsed(false)}
          onMouseEnter={() => setStripHovered(true)}
          onMouseLeave={() => setStripHovered(false)}
          data-testid="mqtt-saved-rail-strip"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            width: 26,
            padding: '8px 0',
            marginLeft: 8,
            border: 'none',
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            background: stripHovered ? token.colorFillTertiary : token.colorFillQuaternary,
            cursor: 'pointer',
            color: token.colorTextSecondary,
          }}
        >
          <LeftOutlined style={{ fontSize: 10, flexShrink: 0 }} />
          <span
            style={{
              writingMode: 'vertical-lr',
              fontSize: 12,
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {t('workbench.editors.mqtt.saved.title')}
          </span>
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      style={{
        width: 208,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        paddingLeft: 8,
        marginLeft: 8,
        overflow: 'auto',
      }}
      data-testid="mqtt-saved-rail"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.saved.title')}
        </Text>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Tooltip title={t('workbench.editors.mqtt.saved.addTooltip')}>
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined style={{ fontSize: 10 }} />}
              onClick={addSavedMessageFromCompose}
              data-testid="mqtt-saved-add"
            />
          </Tooltip>
          <Tooltip title={t('workbench.editors.mqtt.saved.hideRail')}>
            <Button
              size="small"
              type="text"
              icon={<RightOutlined style={{ fontSize: 10 }} />}
              onClick={() => setCollapsed(true)}
              aria-label={t('workbench.editors.mqtt.saved.hideRail')}
              data-testid="mqtt-saved-rail-hide"
            />
          </Tooltip>
        </span>
      </div>
      {draft.savedMessages.length === 0 && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.mqtt.saved.emptyHint')}
        </Text>
      )}
      {draft.savedMessages.map((row) => (
        <div key={row.uid} style={{ display: 'flex', alignItems: 'center', gap: 4 }} data-testid="mqtt-saved-row">
          {renamingSavedUid === row.uid ? (
            <Input
              size="small"
              autoFocus
              defaultValue={row.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                setRenamingSavedUid(null);
                if (!name) return;
                setDraft((d) => ({
                  ...d,
                  savedMessages: d.savedMessages.map((m) => (m.uid === row.uid ? { ...m, name } : m)),
                }));
              }}
              onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <Button
              size="small"
              type="text"
              style={{
                flex: 1,
                minWidth: 0,
                justifyContent: 'flex-start',
                fontSize: 11,
                overflow: 'hidden',
              }}
              onClick={() => loadSavedMessage(row)}
              title={row.topic}
            >
              {row.name}
            </Button>
          )}
          {/* Send-from-row — publishes the saved preset AS STORED while
            the session is open; the compose surface stays untouched. */}
          {sessionOpen && (
            <Tooltip title={t('workbench.editors.mqtt.saved.sendTooltip')}>
              <Button
                size="small"
                type="text"
                icon={<SendOutlined style={{ fontSize: 11 }} />}
                onClick={() =>
                  onPublish({
                    topic: row.topic,
                    payload: row.payload,
                    ...(row.format !== undefined ? { format: row.format } : {}),
                    ...(row.qos !== undefined ? { qos: row.qos } : {}),
                    ...(row.retain !== undefined ? { retain: row.retain } : {}),
                    ...(row.properties !== undefined ? { properties: row.properties } : {}),
                  })
                }
                data-testid="mqtt-saved-row-send"
              />
            </Tooltip>
          )}
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'rename',
                  label: t('workbench.editors.mqtt.saved.rename'),
                  onClick: () => setRenamingSavedUid(row.uid),
                },
                {
                  key: 'duplicate',
                  label: t('workbench.editors.mqtt.saved.duplicate'),
                  onClick: () =>
                    setDraft((d) => ({
                      ...d,
                      savedMessages: [...d.savedMessages, { ...row, uid: generateUid() }],
                    })),
                },
                {
                  key: 'delete',
                  label: t('workbench.editors.mqtt.saved.delete'),
                  danger: true,
                  onClick: () =>
                    setDraft((d) => ({
                      ...d,
                      savedMessages: d.savedMessages.filter((m) => m.uid !== row.uid),
                    })),
                },
              ],
            }}
          >
            <Button size="small" type="text" icon={<MoreOutlined style={{ fontSize: 11 }} />} data-testid="mqtt-saved-row-menu" />
          </Dropdown>
        </div>
      ))}
    </div>
  );
};

export default MqttSavedMessagesRail;
