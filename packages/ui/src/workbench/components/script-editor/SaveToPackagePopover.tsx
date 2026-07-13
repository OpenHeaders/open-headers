/**
 * SaveToPackagePopover — "Save to Package Library" from a script-editor
 * selection. Two paths, matching the context-menu submenu vocabulary:
 *
 *   - Existing Package → appends the selection to that package's
 *     source (separated by a blank line).
 *   - New Package → names a fresh package whose source IS the
 *     selection.
 *
 * Writes go through the script-package write client with the explicit
 * editing-scope workspaceId. Dismissal (outside click / Esc) is owned
 * here — the popover is mounted directly by the Scripts tab, not by a
 * hover host.
 */

import type { ScriptPackage } from '@openheaders/core/types';
import { App, Button, Empty, Input, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScriptPackages } from '../../../shared/hooks/readers/useScriptPackages';
import {
  applyScriptPackageCreate,
  applyScriptPackageUpdate,
} from '../../../shared/sync/script-package-write-client';
import { usePopoverPlacement } from '@openheaders/ui/shared/popover';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

const POPOVER_WIDTH = 280;
const SURFACE_ID = 'workbench';

export interface SaveToPackagePopoverProps {
  anchorEl: HTMLElement;
  workspaceId: string | null;
  /** The selected script text to save. */
  selectionText: string;
  onClose: () => void;
}

const SaveToPackagePopover: React.FC<SaveToPackagePopoverProps> = ({
  anchorEl,
  workspaceId,
  selectionText,
  onClose,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const packages = useScriptPackages(workspaceId);
  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, POPOVER_WIDTH);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Stable merged ref — an inline ref function would detach/re-attach on
  // every render, and the placement hook resets `measured` on detach,
  // permanently hiding the popover after the first async re-render
  // (the package list hydrating) because the reveal effect runs once.
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      (popoverRef as React.RefCallback<HTMLDivElement>)(node);
    },
    [popoverRef],
  );

  const appendToExisting = async (pkg: ScriptPackage) => {
    if (!workspaceId || saving) return;
    setSaving(true);
    try {
      const source = pkg.source.trim() ? `${pkg.source.replace(/\n+$/, '')}\n\n${selectionText}` : selectionText;
      const result = await applyScriptPackageUpdate(pkg.uid, { source }, { workspaceId, surfaceId: SURFACE_ID });
      if (result.ok) {
        message.success(t('workbench.editors.scriptEditor.savedTo', { name: pkg.name }));
        onClose();
        return;
      }
      message.error(
        result.reason === 'not-found'
          ? t('workbench.editors.scriptEditor.packageNotFound')
          : t('workbench.editors.scriptEditor.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const createNew = async () => {
    const name = newName.trim();
    if (!workspaceId || !name || saving) return;
    setSaving(true);
    try {
      const result = await applyScriptPackageCreate(
        { scriptPackage: { name, source: selectionText } },
        { workspaceId, surfaceId: SURFACE_ID },
      );
      if (result.ok) {
        message.success(t('workbench.editors.scriptEditor.packageCreated', { name }));
        onClose();
        return;
      }
      if (result.reason === 'duplicate-name') {
        message.error(t('workbench.editors.scriptEditor.duplicatePackage', { name }));
        return;
      }
      message.error(t('workbench.editors.scriptEditor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      ref={mergedRef}
      role="dialog"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: 12,
        opacity: measured ? 1 : 0,
        pointerEvents: measured ? undefined : 'none',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        {t('workbench.editors.scriptEditor.saveToPackage')}
      </div>
      {creating ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="package_name"
            aria-label={t('workbench.editors.scriptEditor.newPackageName')}
            onPressEnter={() => void createNew()}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button size="small" onClick={() => setCreating(false)}>
              {t('workbench.editors.scriptEditor.back')}
            </Button>
            <Button
              size="small"
              type="primary"
              loading={saving}
              disabled={!newName.trim()}
              onClick={() => void createNew()}
            >
              {t('workbench.editors.scriptEditor.create')}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Button size="small" onClick={() => setCreating(true)} style={{ alignSelf: 'flex-start' }}>
            {t('workbench.editors.scriptEditor.newPackage')}
          </Button>
          <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
            {t('workbench.editors.scriptEditor.orAppend')}
          </Text>
          <div style={{ maxHeight: 180, overflowY: 'auto', overscrollBehavior: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {packages.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('workbench.editors.scriptEditor.noPackagesYet')}
                style={{ margin: '8px 0' }}
              />
            )}
            {packages.map((pkg) => (
              <button
                key={pkg.uid}
                type="button"
                onClick={() => void appendToExisting(pkg)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '5px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: token.colorText,
                  fontSize: 12,
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={pkg.description || pkg.name}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = token.colorFillTertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {pkg.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default SaveToPackagePopover;
