/**
 * AncestorScriptsLine — the active slot's ancestor line in the Scripts
 * tab's toolbar row: "Runs after 2 scripts: Collection ‘Payments’ ·
 * Folder ‘Tokens’" — the levels the executor composes ahead of this
 * request's slot, outer → inner (the order they run in), each name a
 * link opening that container's Scripts section. Silent when no
 * ancestor carries a script for the slot.
 *
 * Scripts compose rather than resolve, so this line is the whole of
 * the request's inheritance UI: nothing to pick, nothing to override.
 */

import { Button, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { AncestorScriptLevel } from '../request-container/ancestry';
import { inheritSourceLabel } from '../request-editor/inherited-auth';

export type OpenContainerScripts = (kind: 'collection' | 'folder', uid: string, name: string) => void;

const AncestorScriptsLine: React.FC<{
  levels: readonly AncestorScriptLevel[];
  onOpen?: OpenContainerScripts;
}> = ({ levels, onOpen }) => {
  const { token } = theme.useToken();
  const t = useT();
  if (levels.length === 0) return null;
  return (
    <span
      data-testid="oh-scripts-runs-after"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 4,
        fontSize: 12,
        color: token.colorTextSecondary,
      }}
    >
      <span>
        {levels.length === 1
          ? t('workbench.editors.request.scripts.runsAfterOne')
          : t('workbench.editors.request.scripts.runsAfter', { count: levels.length })}
      </span>
      {levels.map((level, i) => (
        <span key={level.uid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span aria-hidden>·</span>}
          <Button
            type="link"
            size="small"
            data-testid="oh-scripts-ancestor-link"
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
            disabled={onOpen === undefined}
            onClick={() => onOpen?.(level.kind, level.uid, level.name)}
          >
            {inheritSourceLabel(t, level)}
          </Button>
        </span>
      ))}
    </span>
  );
};

export default AncestorScriptsLine;
