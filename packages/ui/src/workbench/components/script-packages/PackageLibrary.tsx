/**
 * PackageLibrary — singleton tab body for the workspace's script
 * packages: named, reusable modules that pre-request / post-response
 * scripts load via `oh.require('<name>')`.
 *
 * Left rail: search + package list + New Package. Right pane: the
 * selected package's name / description / module source (shared
 * CodeEditor host), or a three-step primer when nothing is selected.
 *
 * Reads through the per-workspace script-package sync mirror and
 * writes through the script-package write client — no context
 * provider stack; the tab body hands the editing-scope workspaceId
 * down as a prop. Dirty derives from draft-vs-canonical equality and
 * flows to the tab chrome via `onDirtyChange`.
 */

import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ScriptPackage } from '@openheaders/core/types';
import { App, Button, Empty, Input, Popconfirm, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScriptPackages } from '../../../shared/hooks/readers/useScriptPackages';
import {
  applyScriptPackageCreate,
  applyScriptPackageDelete,
  applyScriptPackageUpdate,
} from '../../../shared/sync/script-package-write-client';
import CodeEditor from '../shared/CodeEditor';

const { Text } = Typography;

const SURFACE_ID = 'workbench';

interface PackageDraft {
  name: string;
  description: string;
  source: string;
}

const EMPTY_DRAFT: PackageDraft = { name: '', description: '', source: '' };

function draftOf(pkg: ScriptPackage): PackageDraft {
  return { name: pkg.name, description: pkg.description ?? '', source: pkg.source };
}

function draftsEqual(a: PackageDraft, b: PackageDraft): boolean {
  return a.name === b.name && a.description === b.description && a.source === b.source;
}

interface PackageLibraryProps {
  workspaceId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

type Selection = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; uid: string };

const PackageLibrary: React.FC<PackageLibraryProps> = ({ workspaceId, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const packages = useScriptPackages(workspaceId);

  const [selection, setSelection] = useState<Selection>({ kind: 'none' });
  const [draft, setDraft] = useState<PackageDraft>(EMPTY_DRAFT);
  const [search, setSearch] = useState('');

  const selected = selection.kind === 'edit' ? (packages.find((p) => p.uid === selection.uid) ?? null) : null;

  // A selected package deleted elsewhere (peer sync) drops back to the
  // empty state instead of editing a ghost.
  useEffect(() => {
    if (selection.kind === 'edit' && !selected) {
      setSelection({ kind: 'none' });
      setDraft(EMPTY_DRAFT);
    }
  }, [selection, selected]);

  const isDirty =
    selection.kind === 'create'
      ? !draftsEqual(draft, EMPTY_DRAFT)
      : selection.kind === 'edit' && selected != null && !draftsEqual(draft, draftOf(selected));

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return packages;
    return packages.filter((p) => p.name.toLowerCase().includes(needle));
  }, [packages, search]);

  const select = useCallback(
    (next: Selection, nextDraft: PackageDraft) => {
      if (isDirty) {
        modal.confirm({
          title: 'Discard unsaved changes?',
          content: 'The current package has unsaved edits. Switching discards them.',
          okText: 'Discard',
          okButtonProps: { danger: true },
          onOk: () => {
            setSelection(next);
            setDraft(nextDraft);
          },
        });
        return;
      }
      setSelection(next);
      setDraft(nextDraft);
    },
    [isDirty, modal],
  );

  const save = useCallback(async () => {
    if (!workspaceId || !isDirty) return;
    const name = draft.name.trim();
    if (!name) {
      message.error('Package name is required — it is the oh.require key.');
      return;
    }
    const payload = {
      name,
      description: draft.description.trim() ? draft.description.trim() : undefined,
      source: draft.source,
    };
    const opts = { workspaceId, surfaceId: SURFACE_ID };
    const result =
      selection.kind === 'create'
        ? await applyScriptPackageCreate({ scriptPackage: payload }, opts)
        : selection.kind === 'edit'
          ? await applyScriptPackageUpdate(selection.uid, payload, opts)
          : null;
    if (!result) return;
    if (result.ok) {
      message.success('Package saved');
      setSelection({ kind: 'edit', uid: result.scriptPackage.uid });
      setDraft(draftOf(result.scriptPackage));
      return;
    }
    if (result.reason === 'duplicate-name') {
      message.error(`A package named “${name}” already exists in this workspace.`);
      return;
    }
    message.error(result.reason === 'not-found' ? 'Package not found — it may have been deleted.' : 'Save failed');
  }, [workspaceId, isDirty, draft, selection, message]);

  // Cmd+S routes through the tab shell's save registry.
  useEffect(() => {
    registerSaveRef?.(() => {
      void save();
    });
  }, [registerSaveRef, save]);

  const remove = useCallback(
    async (uid: string) => {
      if (!workspaceId) return;
      const result = await applyScriptPackageDelete(uid, { workspaceId, surfaceId: SURFACE_ID });
      if (result.ok) {
        message.success('Package deleted');
        if (selection.kind === 'edit' && selection.uid === uid) {
          setSelection({ kind: 'none' });
          setDraft(EMPTY_DRAFT);
        }
        return;
      }
      message.error(result.reason === 'not-found' ? 'Package not found — it may have been deleted.' : 'Delete failed');
    },
    [workspaceId, selection, message],
  );

  const codeBlock = (code: string) => (
    <pre
      style={{
        margin: 0,
        padding: '8px 12px',
        background: token.colorFillTertiary,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: '20px',
        overflowX: 'auto', overscrollBehavior: 'none',
      }}
    >
      {code}
    </pre>
  );

  const primer = (
    <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Text strong>Reuse scripts across requests with packages</Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Text type="secondary">1. Create a package with some reusable code.</Text>
        {codeBlock(`function add(a, b) {\n  return a + b;\n}`)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Text type="secondary">2. Export the functions you want to reuse.</Text>
        {codeBlock(`module.exports = { add };`)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Text type="secondary">3. Use oh.require to load the package in your request scripts.</Text>
        {codeBlock(`const myPackage = oh.require('package_name');\nmyPackage.add(1, 2);`)}
      </div>
    </div>
  );

  const editorPane = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="package_name"
          aria-label="Package name"
          style={{ maxWidth: 260 }}
        />
        <Input
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Description (optional)"
          aria-label="Package description"
          style={{ flex: 1 }}
        />
        <Button type="primary" disabled={!isDirty} onClick={() => void save()}>
          Save
        </Button>
        {selection.kind === 'edit' && (
          <Popconfirm
            title="Delete this package?"
            description="Scripts calling oh.require on it will start failing."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => void remove(selection.uid)}
          >
            <Button danger>Delete</Button>
          </Popconfirm>
        )}
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Load it from a script with <Text code>oh.require('{draft.name.trim() || 'package_name'}')</Text> — export the
        public surface via <Text code>module.exports</Text>.
      </Text>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <CodeEditor
          language="javascript"
          value={draft.source}
          onChange={(source) => setDraft((d) => ({ ...d, source }))}
          minHeight={320}
          placeholder="Write reusable JavaScript, then export with module.exports."
          variableAutoComplete={false}
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 400, padding: 16 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 240,
          paddingRight: 12,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text strong>Package Library</Text>
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined />}
            onClick={() => select({ kind: 'create' }, EMPTY_DRAFT)}
          >
            New
          </Button>
        </div>
        <Input
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find packages..."
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          allowClear
        />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={packages.length === 0 ? 'No packages yet' : 'No package found'}
              style={{ marginTop: 24 }}
            />
          )}
          {filtered.map((pkg) => {
            const active = selection.kind === 'edit' && selection.uid === pkg.uid;
            return (
              <button
                key={pkg.uid}
                type="button"
                onClick={() => select({ kind: 'edit', uid: pkg.uid }, draftOf(pkg))}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 10px',
                  background: active ? token.colorFillTertiary : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: token.colorText,
                  fontSize: 13,
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={pkg.description || pkg.name}
              >
                {pkg.name}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {selection.kind === 'none' ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{primer}</div>
        ) : (
          editorPane
        )}
      </div>
    </div>
  );
};

export default PackageLibrary;
