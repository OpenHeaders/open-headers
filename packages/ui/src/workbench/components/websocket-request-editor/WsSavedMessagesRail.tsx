/**
 * WsSavedMessagesRail — the Saved-messages rail beside the message
 * editor, the MQTT rail's anatomy without the publish knobs: synced
 * entity rows, not local state (they travel with the workspace and
 * git-sync). Clicking a row SELECTS it — the compose loads its content
 * and every compose edit writes through to it (the
 * `useWsSavedSelection` binding); `+` captures the compose as a new
 * selected row and opens the inline rename with the name pre-selected;
 * deleting the selected row hands the selection to its neighbor.
 * Send-from-row sends AS STORED while the session is open; rename/
 * duplicate/delete ride the row's ⋯ menu. Each row wears its compose
 * mode as a small tag (Text / JSON / … / Binary) so the list scans.
 *
 * COLLAPSIBLE: hidden, the rail swaps for the narrow vertical
 * `WsSavedMessagesStrip` — a `<` chevron and the rotated title, the
 * whole strip one button that brings the rail back. The collapse
 * state lives on the Message tab, which mounts the EXPANDED rail in
 * its own Allotment pane (the sash is the only divider) and the strip
 * flush beside the editor otherwise.
 */

import { LeftOutlined, MoreOutlined, PlusOutlined, RightOutlined, SendOutlined } from '@ant-design/icons';
import type { WebSocketMessageFormat, WebSocketSavedMessage } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Input, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { composeAsSavedMessage, nextSavedMessageName, type WebSocketDraft } from './draft';

const { Text } = Typography;

const FORMAT_LABEL_KEYS: Record<WebSocketMessageFormat, MessageKey> = {
  text: 'workbench.editors.websocket.message.formatText',
  json: 'workbench.editors.websocket.message.formatJson',
  xml: 'workbench.editors.websocket.message.formatXml',
  html: 'workbench.editors.websocket.message.formatHtml',
  binary: 'workbench.editors.websocket.message.formatBinary',
};

/** The rail's collapsed state — a narrow vertical strip, flush beside
 *  the editor (no fill, no border of its own — the smooth edge), the
 *  whole strip one button that brings the rail back. */
export const WsSavedMessagesStrip: React.FC<{ onExpand: () => void }> = ({ onExpand }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [hovered, setHovered] = useState(false);
  return (
    <Tooltip placement="left" title={t('workbench.editors.websocket.saved.showRail')}>
      <button
        type="button"
        aria-label={t('workbench.editors.websocket.saved.showRail')}
        onClick={onExpand}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-testid="ws-saved-rail-strip"
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
        <span style={{ writingMode: 'vertical-lr', fontSize: 12, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.websocket.saved.title')}
        </span>
      </button>
    </Tooltip>
  );
};

interface WsSavedMessagesRailProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  socketioFlavor: boolean;
  sessionOpen: boolean;
  /** The row the compose is BOUND to — edits write through to it. */
  selectedUid: string | null;
  /** Select a row (loading it into the compose); `null` clears. */
  onSelect: (uid: string | null) => void;
  /** Send a saved row as stored — the session plane's rider. */
  onSend: (row: WebSocketSavedMessage) => void;
  onHide: () => void;
}

const WsSavedMessagesRail: React.FC<WsSavedMessagesRailProps> = ({
  draft,
  setDraft,
  socketioFlavor,
  sessionOpen,
  selectedUid,
  onSelect,
  onSend,
  onHide,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [renamingSavedUid, setRenamingSavedUid] = useState<string | null>(null);
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);

  // `+` captures the compose as a new row, SELECTS it (the compose is
  // already its content — the binding starts live), and opens the
  // inline rename with the name pre-selected.
  const addSavedMessageFromCompose = () => {
    const uid = generateUid();
    setDraft((d) => {
      const name = nextSavedMessageName(d.savedMessages, t('workbench.editors.websocket.saved.defaultName'));
      return { ...d, savedMessages: [...d.savedMessages, composeAsSavedMessage(d, uid, name)] };
    });
    onSelect(uid);
    setRenamingSavedUid(uid);
  };

  const deleteSavedMessage = (row: WebSocketSavedMessage) => {
    // The neighbor inherits the selection — next row first, else the
    // previous one — so one row stays selected while any exist.
    const rows = draft.savedMessages;
    const index = rows.findIndex((m) => m.uid === row.uid);
    setDraft((d) => ({ ...d, savedMessages: d.savedMessages.filter((m) => m.uid !== row.uid) }));
    if (row.uid === selectedUid) onSelect(rows[index + 1]?.uid ?? rows[index - 1]?.uid ?? null);
  };

  const duplicateSavedMessage = (row: WebSocketSavedMessage) => {
    const uid = generateUid();
    setDraft((d) => ({ ...d, savedMessages: [...d.savedMessages, { ...row, uid }] }));
    onSelect(uid);
  };

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 4, overflow: 'auto' }}
      data-testid="ws-saved-rail"
    >
      {/* The rail's left indent lives on the header and hint, not the
        container — selection/hover bands bleed the full row width. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8 }}>
        <Text strong style={{ fontSize: 11 }}>
          {t('workbench.editors.websocket.saved.title')}
        </Text>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Tooltip title={t('workbench.editors.websocket.saved.addTooltip')}>
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined style={{ fontSize: 10 }} />}
              onClick={addSavedMessageFromCompose}
              data-testid="ws-saved-add"
            />
          </Tooltip>
          <Tooltip title={t('workbench.editors.websocket.saved.hideRail')}>
            <Button
              size="small"
              type="text"
              icon={<RightOutlined style={{ fontSize: 10 }} />}
              onClick={onHide}
              aria-label={t('workbench.editors.websocket.saved.hideRail')}
              data-testid="ws-saved-rail-hide"
            />
          </Tooltip>
        </span>
      </div>
      {draft.savedMessages.length === 0 && (
        <Text type="secondary" style={{ fontSize: 11, paddingLeft: 8 }}>
          {t('workbench.editors.websocket.saved.emptyHint')}
        </Text>
      )}
      {draft.savedMessages.map((row) => {
        const selected = row.uid === selectedUid;
        // A socketio row is an event; a raw row wears its compose mode.
        const tagText = socketioFlavor
          ? row.eventName?.trim() || t('workbench.editors.websocket.timeline.sio.eventNoName')
          : t(FORMAT_LABEL_KEYS[row.messageFormat ?? 'text']);
        return (
          <div
            key={row.uid}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 2px 1px 8px',
              background: selected
                ? token.colorFillSecondary
                : hoveredUid === row.uid
                  ? token.colorFillTertiary
                  : 'transparent',
            }}
            onMouseEnter={() => setHoveredUid(row.uid)}
            onMouseLeave={() => setHoveredUid((uid) => (uid === row.uid ? null : uid))}
            data-testid="ws-saved-row"
            data-selected={selected ? 'true' : undefined}
          >
            <Tag
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
              data-testid="ws-saved-row-format"
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
                style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', fontSize: 11, overflow: 'hidden' }}
                onClick={() => onSelect(row.uid)}
              >
                {row.name}
              </Button>
            )}
            {/* Send-from-row — sends the saved row AS STORED while the
              session is open; the compose surface stays untouched. */}
            {sessionOpen && (
              <Tooltip title={t('workbench.editors.websocket.saved.sendTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<SendOutlined style={{ fontSize: 11 }} />}
                  onClick={() => onSend(row)}
                  data-testid="ws-saved-row-send"
                />
              </Tooltip>
            )}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'rename',
                    label: t('workbench.editors.websocket.saved.rename'),
                    onClick: () => setRenamingSavedUid(row.uid),
                  },
                  {
                    key: 'duplicate',
                    label: t('workbench.editors.websocket.saved.duplicate'),
                    onClick: () => duplicateSavedMessage(row),
                  },
                  {
                    key: 'delete',
                    label: t('workbench.editors.websocket.saved.delete'),
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
                data-testid="ws-saved-row-menu"
              />
            </Dropdown>
          </div>
        );
      })}
    </div>
  );
};

export default WsSavedMessagesRail;
