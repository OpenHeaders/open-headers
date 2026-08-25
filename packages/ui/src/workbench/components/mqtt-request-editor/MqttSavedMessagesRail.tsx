/**
 * MqttSavedMessagesRail — the Saved-messages rail beside the payload
 * editor: synced entity rows, not local state (they travel with the
 * workspace and git-sync). Clicking a row loads the compose;
 * Send-from-row publishes AS STORED while the session is open; rename/
 * duplicate/delete ride the row's ⋯ menu.
 *
 * COLLAPSIBLE (the git log's Branches-rail gesture, mirrored to the
 * right edge): hidden, the rail swaps for the narrow vertical
 * `MqttSavedMessagesStrip` — a `<` chevron and the rotated title, the
 * whole strip one button that brings the rail back. The collapse
 * state lives on the Message tab, which mounts the EXPANDED rail in
 * its own Allotment pane (the sash is the only divider — no border of
 * its own) and the strip flush beside the editor otherwise.
 */

import { LeftOutlined, MoreOutlined, PlusOutlined, RightOutlined, SendOutlined } from '@ant-design/icons';
import type { MqttPublishWire } from '@openheaders/core/bridge';
import type { MqttSavedMessage } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Input, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { savedTopicTagColor } from './compose';
import { buildMqttRequestUpdates, type MqttDraft, propertiesToDraft } from './draft';

const { Text } = Typography;

/** The rail's collapsed state — a narrow vertical strip, flush beside
 *  the editor (no fill, no border of its own — the smooth edge), the
 *  whole strip one button that brings the rail back. */
export const MqttSavedMessagesStrip: React.FC<{ onExpand: () => void }> = ({ onExpand }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [hovered, setHovered] = useState(false);
  return (
    <Tooltip placement="left" title={t('workbench.editors.mqtt.saved.showRail')}>
      <button
        type="button"
        aria-label={t('workbench.editors.mqtt.saved.showRail')}
        onClick={onExpand}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-testid="mqtt-saved-rail-strip"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          width: 26,
          padding: '8px 0',
          border: 'none',
          background: hovered ? token.colorFillTertiary : 'transparent',
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
};

interface MqttSavedMessagesRailProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  sessionOpen: boolean;
  onPublish: (message: MqttPublishWire) => void;
  onHide: () => void;
}

const MqttSavedMessagesRail: React.FC<MqttSavedMessagesRailProps> = ({
  draft,
  setDraft,
  sessionOpen,
  onPublish,
  onHide,
}) => {
  const t = useT();
  const [renamingSavedUid, setRenamingSavedUid] = useState<string | null>(null);

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

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingLeft: 8,
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
              onClick={onHide}
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
      {draft.savedMessages.map((row) => {
        /* The topic tag rides every row — the saved topic verbatim, the
           placeholder word when empty; color derives from the tag TEXT
           so equal topics wear equal colors. */
        const tagText = row.topic.trim() !== '' ? row.topic : t('workbench.editors.mqtt.saved.topicTagPlaceholder');
        return (
          <div key={row.uid} style={{ display: 'flex', alignItems: 'center', gap: 4 }} data-testid="mqtt-saved-row">
            <Tag
              color={savedTopicTagColor(tagText)}
              title={row.topic.trim() !== '' ? row.topic : undefined}
              style={{
                flexShrink: 0,
                maxWidth: 96,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 10,
                lineHeight: '16px',
                marginInlineEnd: 0,
              }}
              data-testid="mqtt-saved-row-topic"
            >
              {tagText}
            </Tag>
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
              <Button
                size="small"
                type="text"
                icon={<MoreOutlined style={{ fontSize: 11 }} />}
                data-testid="mqtt-saved-row-menu"
              />
            </Dropdown>
          </div>
        );
      })}
    </div>
  );
};

export default MqttSavedMessagesRail;
