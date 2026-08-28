/**
 * MqttSavedMessagesRail — the Saved-messages rail beside the payload
 * editor: synced entity rows, not local state (they travel with the
 * workspace and git-sync). Clicking a row SELECTS it — the compose
 * loads its content and every compose edit writes through to it (the
 * `useMqttSavedSelection` binding); `+` captures the compose as a new
 * selected row and opens the inline rename with the name pre-selected;
 * deleting the selected row hands the selection to its neighbor.
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
import { composeAsSavedMessage, type MqttDraft } from './draft';

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
  /** The row the compose is BOUND to — edits write through to it. */
  selectedUid: string | null;
  /** Select a row (loading it into the compose); `null` clears. */
  onSelect: (uid: string | null) => void;
  onPublish: (message: MqttPublishWire) => void;
  onHide: () => void;
}

const MqttSavedMessagesRail: React.FC<MqttSavedMessagesRailProps> = ({
  draft,
  setDraft,
  sessionOpen,
  selectedUid,
  onSelect,
  onPublish,
  onHide,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [renamingSavedUid, setRenamingSavedUid] = useState<string | null>(null);
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);
  // The row's menu reveals on hover, keyboard focus, selection, or
  // while its dropdown is open — never conditionally rendered, so the
  // name column never jumps.
  const [focusedUid, setFocusedUid] = useState<string | null>(null);
  const [menuOpenUid, setMenuOpenUid] = useState<string | null>(null);

  // `+` captures the compose as a new row, SELECTS it (the compose is
  // already its content — the binding starts live), and opens the
  // inline rename with the name pre-selected.
  const addSavedMessageFromCompose = () => {
    const uid = generateUid();
    setDraft((d) => {
      const baseName = t('workbench.editors.mqtt.saved.defaultName');
      const names = new Set(d.savedMessages.map((m) => m.name));
      let name = baseName;
      let counter = 2;
      while (names.has(name)) name = `${baseName} (${counter++})`;
      return { ...d, savedMessages: [...d.savedMessages, composeAsSavedMessage(d, uid, name)] };
    });
    onSelect(uid);
    setRenamingSavedUid(uid);
  };

  const deleteSavedMessage = (row: MqttSavedMessage) => {
    // The neighbor inherits the selection — next row first, else the
    // previous one — so one row stays selected while any exist.
    const rows = draft.savedMessages;
    const index = rows.findIndex((m) => m.uid === row.uid);
    setDraft((d) => ({ ...d, savedMessages: d.savedMessages.filter((m) => m.uid !== row.uid) }));
    if (row.uid === selectedUid) onSelect(rows[index + 1]?.uid ?? rows[index - 1]?.uid ?? null);
  };

  const duplicateSavedMessage = (row: MqttSavedMessage) => {
    const uid = generateUid();
    setDraft((d) => ({ ...d, savedMessages: [...d.savedMessages, { ...row, uid }] }));
    onSelect(uid);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 0,
      }}
      data-testid="mqtt-saved-rail"
    >
      {/* The rail's left indent lives on the header and hint, not the
        container — selection/hover bands bleed the full row width. The
        header reserves the list's scrollbar gutter (a hidden-overflow
        box still owns one) so + and the chevron share the rows' menu
        column instead of sitting under the bar. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 8,
          overflow: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarGutter: 'stable',
        }}
      >
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
      {/* Only the list scrolls — the header keeps its buttons in
        place. A thin PERSISTENT bar (the standard properties, never the
        webkit pseudos) with its gutter reserved: the macOS overlay bar
        takes no space and paints over the rows' menu column. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflow: 'auto',
          overscrollBehavior: 'none',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(128, 128, 128, 0.45) transparent',
          scrollbarGutter: 'stable',
        }}
        data-testid="mqtt-saved-list"
      >
        {draft.savedMessages.length === 0 && (
          <Text type="secondary" style={{ fontSize: 11, paddingLeft: 8 }}>
            {t('workbench.editors.mqtt.saved.emptyHint')}
          </Text>
        )}
        {draft.savedMessages.map((row) => {
          /* The topic tag rides every row — the saved topic verbatim, the
             placeholder word when empty; color derives from the tag TEXT
             so equal topics wear equal colors. */
          const tagText = row.topic.trim() !== '' ? row.topic : t('workbench.editors.mqtt.saved.topicTagPlaceholder');
          const selected = row.uid === selectedUid;
          const menuVisible =
            selected || hoveredUid === row.uid || focusedUid === row.uid || menuOpenUid === row.uid;
          return (
            <div
              key={row.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 6px 1px 8px',
                background: selected
                  ? token.colorFillSecondary
                  : hoveredUid === row.uid
                    ? token.colorFillTertiary
                    : 'transparent',
              }}
              onMouseEnter={() => setHoveredUid(row.uid)}
              onMouseLeave={() => setHoveredUid((uid) => (uid === row.uid ? null : uid))}
              onFocus={() => setFocusedUid(row.uid)}
              onBlur={() => setFocusedUid((uid) => (uid === row.uid ? null : uid))}
              data-testid="mqtt-saved-row"
              data-selected={selected ? 'true' : undefined}
            >
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
                  onFocus={(e) => e.target.select()}
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
                  onClick={() => onSelect(row.uid)}
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
                onOpenChange={(open) => setMenuOpenUid(open ? row.uid : null)}
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
                      onClick: () => duplicateSavedMessage(row),
                    },
                    {
                      key: 'delete',
                      label: t('workbench.editors.mqtt.saved.delete'),
                      danger: true,
                      onClick: () => deleteSavedMessage(row),
                    },
                  ],
                }}
              >
                <Button
                  size="small"
                  type="text"
                  icon={<MoreOutlined style={{ fontSize: 11 }} />}
                  style={{ visibility: menuVisible ? 'visible' : 'hidden' }}
                  data-testid="mqtt-saved-row-menu"
                />
              </Dropdown>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MqttSavedMessagesRail;
