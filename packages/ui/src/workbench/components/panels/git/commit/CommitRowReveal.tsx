/**
 * CommitRowReveal — the Commit tree's expanding hover overlay: a file's
 * row listed by path whose content is clipped shows its full form over
 * itself while the pointer is on it, reaching past the panel edge (the
 * reference gesture); a row that fits shows nothing. Measured on enter
 * only; a scroll, a resize or the pointer leaving the row clears it.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { theme } from 'antd';
import type React from 'react';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import CommitFileFace, { COMMIT_ROW_FONT } from './CommitFileFace';
import type { VcsPalette } from './vcs-colors';

/** The hovered clipped row the overlay expands. */
export interface RevealedRow {
  key: string;
  left: number;
  top: number;
  height: number;
  row: WorkspaceTreeWorkingChangeWire;
  suffix: string;
}

export interface CommitRowRevealApi {
  revealed: RevealedRow | null;
  enter: (element: HTMLElement, key: string, row: WorkspaceTreeWorkingChangeWire, suffix: string) => void;
  leave: (key: string) => void;
}

/** True when any ellipsized span inside `element` hides part of its text. */
function hasClippedChild(element: HTMLElement): boolean {
  for (const child of element.querySelectorAll<HTMLElement>('span')) {
    if (child.scrollWidth > child.clientWidth + 1) return true;
  }
  return false;
}

export function useCommitRowReveal(containerRef: RefObject<HTMLElement | null>): CommitRowRevealApi {
  const [revealed, setRevealed] = useState<RevealedRow | null>(null);

  useEffect(() => {
    if (revealed === null) return;
    const container = containerRef.current;
    const clear = (): void => setRevealed(null);
    container?.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('resize', clear);
    return () => {
      container?.removeEventListener('scroll', clear);
      window.removeEventListener('resize', clear);
    };
  }, [revealed, containerRef]);

  const enter = useCallback(
    (element: HTMLElement, key: string, row: WorkspaceTreeWorkingChangeWire, suffix: string): void => {
      const content = element.querySelector<HTMLElement>('[data-row-content]');
      if (content === null) return;
      const clipped = content.scrollWidth > content.clientWidth + 1 || hasClippedChild(content);
      if (!clipped) return;
      const rowRect = element.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      setRevealed({ key, left: contentRect.left, top: rowRect.top, height: rowRect.height, row, suffix });
    },
    [],
  );
  const leave = useCallback(
    (key: string): void => setRevealed((prev) => (prev !== null && prev.key === key ? null : prev)),
    [],
  );

  return { revealed, enter, leave };
}

export interface CommitRowRevealProps {
  revealed: RevealedRow | null;
  t: Translate;
  palette: VcsPalette;
}

const ROW_LINE = 16;

const CommitRowReveal: React.FC<CommitRowRevealProps> = ({ revealed, t, palette }) => {
  const { token } = theme.useToken();
  if (revealed === null) return null;
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: revealed.left - 6,
        top: revealed.top,
        height: revealed.height,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px 0 6px',
        boxSizing: 'border-box',
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM,
        boxShadow: token.boxShadowSecondary,
        whiteSpace: 'nowrap',
        fontSize: COMMIT_ROW_FONT,
        lineHeight: `${ROW_LINE}px`,
        color: token.colorText,
        zIndex: token.zIndexPopupBase,
        pointerEvents: 'none',
      }}
      data-testid="commit-tool-row-expanded"
      data-path={revealed.row.path}
    >
      <CommitFileFace
        row={revealed.row}
        suffix={revealed.suffix}
        clip={false}
        t={t}
        textColor={token.colorText}
        dimColor={token.colorTextTertiary}
        palette={palette}
      />
    </div>,
    document.body,
  );
};

export default CommitRowReveal;
