/**
 * Offline-fallback runner order (WS-C C14 commit 3).
 *
 * When an *exclusive* Live Workflow's configured backend goes offline,
 * exactly one of the partitioned browser hosts self-refreshes the
 * credential — chosen by this user-orderable ranking rather than a race.
 * Each host auto-enlists itself (SW-side) once it holds the workflow's
 * consumed seed; this card is where the user re-ranks and prunes that
 * list.
 *
 * Reads the workspace's `live-fallback-priority` mirror (members carry a
 * `Principal.id`, a rank `order`, and a self-stamped host `label`).
 * Drag-to-reorder re-emits the whole list with fresh contiguous ranks;
 * the prune button is the append-only list's only removal path. "This
 * browser" is highlighted via the identity snapshot's principal id —
 * matching the offline election's `selfPrincipalId`.
 */

import { HolderOutlined } from '@ant-design/icons';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LiveFallbackPriorityMember } from '@openheaders/core/types';
import { getActiveRendererContext, getLiveFallbackPrioritySyncMirrorForWorkspace } from '@openheaders/ui/context';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { App as AntApp, Button, Popconfirm, Tag, theme, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  applyFallbackPriorityPrune,
  applyFallbackPriorityReorder,
} from '../../../shared/sync/live-fallback-priority-write-client';

/** Shorten an opaque principal id for the no-label fallback display. */
function shortenPrincipalId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

const OfflineFallbackOrderSection: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const selfPrincipalId = useIdentitySnapshot()?.principal.id ?? null;
  const [members, setMembers] = useState<LiveFallbackPriorityMember[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }
    const mirror = getLiveFallbackPrioritySyncMirrorForWorkspace(workspaceId);
    const sync = (): void => setMembers(mirror.orderedMembers());
    void mirror.hydrated.then(sync);
    sync();
    return mirror.subscribeMirror(sync);
  }, [workspaceId]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!workspaceId) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = members.findIndex((m) => m.principalId === String(active.id));
      const newIndex = members.findIndex((m) => m.principalId === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(members, oldIndex, newIndex);
      setMembers(next); // optimistic; the broadcast reconciles
      const surfaceId = getActiveRendererContext()?.surfaceId ?? 'workbench';
      void applyFallbackPriorityReorder(next, { workspaceId, surfaceId }).then((result) => {
        if (!result.ok) message.error(t('workbench.settings.backendPane.fallback.saveFailed'));
      });
    },
    [workspaceId, members, message, t],
  );

  const handlePrune = useCallback(
    (principalId: string) => {
      if (!workspaceId) return;
      const surfaceId = getActiveRendererContext()?.surfaceId ?? 'workbench';
      void applyFallbackPriorityPrune(principalId, { workspaceId, surfaceId }).then((result) => {
        if (!result.ok) message.error(t('workbench.settings.backendPane.fallback.removeFailed'));
      });
    },
    [workspaceId, message, t],
  );

  return (
    <section style={{ marginBottom: 12 }}>
      <header style={{ marginBottom: 6, padding: '0 2px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: token.colorTextSecondary,
          }}
        >
          {t('workbench.settings.backendPane.fallback.title')}
        </h3>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
          {t('workbench.settings.backendPane.fallback.blurb')}
        </div>
      </header>
      <div
        className="settings-card"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          padding: 12,
        }}
      >
        {members.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.settings.backendPane.fallback.empty')}
          </Typography.Text>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={members.map((m) => m.principalId)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {members.map((member, index) => (
                  <FallbackHostRow
                    key={member.principalId}
                    member={member}
                    rank={index + 1}
                    isSelf={member.principalId === selfPrincipalId}
                    onPrune={() => handlePrune(member.principalId)}
                    tokenColorBorder={token.colorBorderSecondary}
                    tokenColorBg={token.colorBgElevated}
                    tokenColorPrimary={token.colorPrimary}
                    tokenColorTextTertiary={token.colorTextTertiary}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
};

interface FallbackHostRowProps {
  member: LiveFallbackPriorityMember;
  rank: number;
  isSelf: boolean;
  onPrune: () => void;
  tokenColorBorder: string;
  tokenColorBg: string;
  tokenColorPrimary: string;
  tokenColorTextTertiary: string;
}

const FallbackHostRow: React.FC<FallbackHostRowProps> = ({
  member,
  rank,
  isSelf,
  onPrune,
  tokenColorBorder,
  tokenColorBg,
  tokenColorPrimary,
  tokenColorTextTertiary,
}) => {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: member.principalId,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const label = member.label.trim() || shortenPrincipalId(member.principalId);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 10px',
        border: `1px solid ${isSelf ? tokenColorPrimary : tokenColorBorder}`,
        background: tokenColorBg,
        borderRadius: 6,
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('workbench.settings.backendPane.fallback.dragAria')}
        style={{
          cursor: 'grab',
          color: tokenColorTextTertiary,
          display: 'inline-flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
        }}
      >
        <HolderOutlined />
      </button>

      <Typography.Text type="secondary" style={{ fontSize: 12, minWidth: 18 }}>
        {rank}
      </Typography.Text>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          title={label}
        >
          {label}
        </Typography.Text>
        {isSelf && (
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {t('workbench.settings.backendPane.fallback.selfTag')}
          </Tag>
        )}
      </div>

      <Popconfirm
        title={t('workbench.settings.backendPane.fallback.pruneTitle')}
        description={t('workbench.settings.backendPane.fallback.pruneBody')}
        okText={t('shared.action.remove')}
        cancelText={t('shared.action.cancel')}
        okButtonProps={{ danger: true }}
        onConfirm={onPrune}
      >
        <Button type="link" size="small" danger>
          {t('shared.action.remove')}
        </Button>
      </Popconfirm>
    </div>
  );
};

export default OfflineFallbackOrderSection;
