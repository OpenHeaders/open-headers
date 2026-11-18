/**
 * ChangeCounterLine — what the commit would take, at the Amend row's
 * right edge (the reference's): a part per kind in its change's colour
 * — added, modified, deleted — and nothing while nothing is checked.
 * Two forms: the words (`1+2 added  2 modified  2 deleted`) while the
 * row has room for them, the marks (`+1+2  *2  -2`) when it has not.
 * The words are measured where they would stand, so they never clip;
 * in the narrow form they are the marks' tooltip. The line takes the
 * row's free space and keeps to its right edge.
 */

import type { MessageKey } from '@openheaders/i18n';
import { Tooltip } from 'antd';
import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ChangeCounterKind, ChangeCounterPart } from './commit-model';
import { vcsPalette } from './vcs-colors';

export interface ChangeCounterLineProps {
  parts: readonly ChangeCounterPart[];
}

const WORDS: Readonly<Record<ChangeCounterKind, MessageKey>> = {
  added: 'workbench.commitTool.counter.added',
  modified: 'workbench.commitTool.counter.modified',
  deleted: 'workbench.commitTool.counter.deleted',
};

const run: React.CSSProperties = { display: 'inline-flex', gap: 12, whiteSpace: 'nowrap', fontSize: 12 };

const ChangeCounterLine: React.FC<ChangeCounterLineProps> = ({ parts }) => {
  const t = useT();
  const { isDarkMode } = useTheme();
  const palette = vcsPalette(isDarkMode);
  const boxRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLSpanElement>(null);
  const [narrow, setNarrow] = useState(false);

  const worded = parts.map((part) => ({ ...part, words: t(WORDS[part.kind], { count: part.count }) }));
  const words = worded.map((part) => part.words).join(', ');

  // The words fit or they do not: read again when the row's width or the words change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `words` is what the measured run holds
  useLayoutEffect(() => {
    const box = boxRef.current;
    const measured = wordsRef.current;
    if (box === null || measured === null) return;
    const measure = (): void => setNarrow(measured.offsetWidth > box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [words]);

  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative',
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        justifyContent: 'flex-end',
        overflow: 'hidden',
      }}
    >
      {worded.length > 0 && (
        <>
          <span
            ref={wordsRef}
            aria-hidden
            style={{ ...run, position: 'absolute', top: 0, left: 0, width: 'max-content', visibility: 'hidden' }}
          >
            {worded.map((part) => (
              <span key={part.kind}>{part.words}</span>
            ))}
          </span>
          <Tooltip placement="top" title={narrow ? words : undefined}>
            <span style={run} data-testid="commit-tool-counter" data-form={narrow ? 'marks' : 'words'}>
              {worded.map((part) => (
                <span key={part.kind} style={{ color: palette[part.kind] }} data-kind={part.kind}>
                  {narrow ? part.mark : part.words}
                </span>
              ))}
            </span>
          </Tooltip>
        </>
      )}
    </div>
  );
};

export default ChangeCounterLine;
