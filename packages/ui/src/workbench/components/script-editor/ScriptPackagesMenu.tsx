/**
 * ScriptPackagesMenu — "Packages" trigger + searchable popover over the
 * workspace's script packages, sitting left of the Snippets menu in the
 * script editor's floating action bar. Picking a package inserts a
 * ready-to-run `const <ident> = oh.require('<name>');` at the editor
 * cursor (popover stays open, same contract as Snippets). The footer
 * jumps to the Package Library tab for authoring.
 */

import { CodeSandboxOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Popover, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useScriptPackages } from '../../../shared/hooks/readers/useScriptPackages';

interface ScriptPackagesMenuProps {
  workspaceId: string | null;
  onInsert: (code: string) => void;
  /** Open the Package Library tab (footer link). Omitted → link hidden. */
  onOpenLibrary?: () => void;
}

/** `my-package_v2` → `myPackageV2` — a valid identifier for the
 *  require binding. Package names always start with a letter or
 *  underscore (schema-enforced), so the result never needs a prefix. */
function toIdentifier(name: string): string {
  return name.replace(/[-_]+(.)/g, (_, ch: string) => ch.toUpperCase());
}

const ScriptPackagesMenu: React.FC<ScriptPackagesMenuProps> = ({ workspaceId, onInsert, onOpenLibrary }) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const packages = useScriptPackages(workspaceId);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return packages;
    return packages.filter((p) => p.name.toLowerCase().includes(needle));
  }, [packages, query]);

  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const content = (
    <div style={{ width: 224, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Input
        size="small"
        autoFocus
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder="Search packages"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* Same fixed-footprint scroll surface as the Snippets popover. */}
      <div
        className="oh-persistent-scroll"
        style={{ height: 240, overflowY: 'scroll', display: 'flex', flexDirection: 'column', paddingRight: 2 }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: token.colorTextTertiary,
              fontSize: 12,
              textAlign: 'center',
              padding: '0 12px',
            }}
          >
            {packages.length === 0 ? 'No packages in this workspace yet' : 'No package found'}
          </div>
        )}
        {filtered.map((pkg) => (
          <button
            key={pkg.uid}
            type="button"
            onClick={() => onInsert(`const ${toIdentifier(pkg.name)} = oh.require('${pkg.name}');`)}
            title={pkg.description || pkg.name}
            style={{
              padding: '3px 4px',
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
      {onOpenLibrary && (
        <button
          type="button"
          onClick={() => {
            setOpenAndReset(false);
            onOpenLibrary();
          }}
          style={{
            padding: '4px',
            background: 'transparent',
            border: 'none',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            cursor: 'pointer',
            color: token.colorLink,
            fontSize: 12,
            textAlign: 'left',
          }}
        >
          Open Package Library →
        </button>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="topRight"
      open={open}
      onOpenChange={setOpenAndReset}
      destroyOnHidden
      styles={{ container: { padding: 8 } }}
    >
      <Button size="small" type="text" icon={<CodeSandboxOutlined />} data-testid="oh-script-packages">
        Packages
      </Button>
    </Popover>
  );
};

export default ScriptPackagesMenu;
