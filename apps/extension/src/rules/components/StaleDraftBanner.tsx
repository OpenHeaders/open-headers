/**
 * StaleDraftBanner — shown in an editor when the SW rejects a save
 * with `reason: 'stale-draft'` because another workspace tab already
 * wrote a newer version of the entity. The user picks one of two
 * explicit outcomes (ARCHITECTURE.md §13):
 *
 *   • **Reload** — discard this tab's edits, take the server copy,
 *     resume editing from the fresh state. Caller's `onReload`
 *     handler re-hydrates the form from `serverRule` (or from the
 *     store, which has broadcast-refreshed by now).
 *   • **Keep editing** — accept the risk of overwriting the other
 *     tab's changes on the next Save. Caller's `onKeepEditing`
 *     handler typically bumps the tracked `loadedVersion` up to the
 *     server's current version so the next save is accepted.
 *
 * No silent merge, no auto-reload. The prompt is intentionally
 * non-dismissable (no `closable`) so the user can't ignore it — a
 * dismissed banner would mean the next Save silently races again.
 */

import { Alert, Button, Space } from 'antd';
import type React from 'react';

export interface StaleDraftBannerProps {
  /**
   * User-facing entity noun — "rule", "environment", "request",
   * "workspace variables", etc. Used to build the message copy so
   * one banner component serves every editor surface.
   */
  entityLabel: string;
  /** Version the server has on disk right now — strictly greater than
   *  this tab's `loadedVersion`. Shown so power users can see how
   *  many intervening saves they'd overwrite. */
  serverVersion: number;
  /** Version this tab loaded originally. */
  loadedVersion: number;
  /** User picked Reload — caller re-hydrates from the server copy. */
  onReload: () => void;
  /** User picked Keep editing — caller bumps expectedVersion so the
   *  next save wins last-write-wins. */
  onKeepEditing: () => void;
}

const StaleDraftBanner: React.FC<StaleDraftBannerProps> = ({
  entityLabel,
  serverVersion,
  loadedVersion,
  onReload,
  onKeepEditing,
}) => {
  const intervening = Math.max(0, serverVersion - loadedVersion);
  const savedWord = intervening === 1 ? 'save' : 'saves';
  return (
    <Alert
      type="warning"
      showIcon
      message={`This ${entityLabel} was modified in another tab`}
      description={
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          {intervening > 0 ? (
            <>
              {intervening} {savedWord} landed while you had this editor open. Reload to see those changes (your unsaved
              edits will be lost) or keep editing — your version will overwrite the other tab's changes on the next
              save.
            </>
          ) : (
            <>
              Another tab saved this {entityLabel}. Reload to see the changes (your unsaved edits will be lost) or keep
              editing — your version will overwrite the other tab's changes on the next save.
            </>
          )}
        </div>
      }
      action={
        <Space direction="vertical" size={4} style={{ marginLeft: 8 }}>
          <Button size="small" type="primary" onClick={onReload}>
            Reload
          </Button>
          <Button size="small" danger onClick={onKeepEditing}>
            Keep editing
          </Button>
        </Space>
      }
      // Non-dismissable — leaving the prompt up ensures the user
      // makes an explicit choice before the next save.
      style={{ marginBottom: 12 }}
    />
  );
};

export default StaleDraftBanner;
