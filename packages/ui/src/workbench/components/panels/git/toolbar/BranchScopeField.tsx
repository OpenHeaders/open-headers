/**
 * BranchScopeField — the Branch filter's Select…: a field that takes
 * SEVERAL refs, one a line or separated by a bar (the reference's
 * reading). Typing a word lists the refs that hold it, what matched
 * painted; Enter writes the highlighted one over the word and moves the
 * caret to a new line, the arrows move the highlight; the finishing
 * chord applies every value as the log's scope. A value that is no ref
 * keeps the field open and is named. It opens holding the scope as it
 * stands, and is as tall as its lines — the suggestions sit directly
 * under what is being typed, the hint under them.
 */

import { Input, theme } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type React from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { GIT_TEXT_SIZE } from '../git-type-scale';
import type { GitLogScope } from '../log-scope';
import MatchedText from '../MatchedText';
import { makeTextMatcher } from './log-filters';
import {
  scopeFieldSuggestions,
  scopeFieldValues,
  unknownScopeValues,
  withSuggestion,
  wordAtCaret,
} from './scope-field';

export interface BranchScopeFieldProps {
  /** Every name a value may be — HEAD and the refs. */
  names: readonly string[];
  /** The scope as it stands — what the field opens holding. */
  scope: GitLogScope;
  /** The finishing chord, over values that are all names. */
  onFinish: (scope: string[]) => void;
}

const FIELD_WIDTH = 340;

const BranchScopeField: React.FC<BranchScopeFieldProps> = ({ names, scope, onFinish }) => {
  const t = useT();
  const { token } = theme.useToken();
  const fieldRef = useRef<TextAreaRef>(null);
  const [text, setText] = useState(() => (scope.length === 0 ? '' : `${scope.join('\n')}\n`));
  const [caret, setCaret] = useState(text.length);
  const [active, setActive] = useState(0);
  const [unknown, setUnknown] = useState<readonly string[]>([]);
  // Where the caret goes once a text is in the field: after the scope
  // it opens holding, then after each pick.
  const [placed, setPlaced] = useState<number | null>(text.length);

  useLayoutEffect(() => {
    if (placed === null) return;
    fieldRef.current?.resizableTextArea?.textArea.setSelectionRange(placed, placed);
    setPlaced(null);
  }, [placed]);

  const suggestions = useMemo(() => scopeFieldSuggestions(text, caret, names), [text, caret, names]);
  const highlighted = Math.min(active, suggestions.length - 1);
  const matcher = useMemo(() => makeTextMatcher(wordAtCaret(text, caret).typed, false, false), [text, caret]);

  const pick = (name: string): void => {
    const next = withSuggestion(text, caret, name);
    setText(next.text);
    setCaret(next.caret);
    setPlaced(next.caret);
    setActive(0);
    setUnknown([]);
  };

  const finish = (): void => {
    const values = scopeFieldValues(text);
    const missing = unknownScopeValues(values, names);
    if (missing.length > 0) setUnknown(missing);
    else onFinish(values);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      finish();
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      pick(suggestions[highlighted]);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((highlighted + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((highlighted - 1 + suggestions.length) % suggestions.length);
    }
  };

  const readCaret = (event: React.SyntheticEvent<HTMLTextAreaElement>): void => {
    setCaret(event.currentTarget.selectionStart);
  };

  const note: React.CSSProperties = { fontSize: 12, lineHeight: 1.4 };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 4, width: FIELD_WIDTH, padding: 8 }}
      data-testid="git-tool-chip-branch-select"
    >
      <Input.TextArea
        ref={fieldRef}
        autoFocus
        spellCheck={false}
        autoSize={{ minRows: 1, maxRows: 10 }}
        value={text}
        status={unknown.length > 0 ? 'error' : undefined}
        onChange={(event) => {
          setText(event.target.value);
          setCaret(event.target.selectionStart);
          setActive(0);
          setUnknown([]);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={readCaret}
        onClick={readCaret}
        onSelect={readCaret}
        style={{ fontSize: GIT_TEXT_SIZE }}
        data-testid="git-tool-chip-branch-select-field"
      />
      {suggestions.length > 0 && (
        <div role="listbox" style={{ maxHeight: 168, overflowY: 'auto' }}>
          {suggestions.map((name, index) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={index === highlighted}
              className="git-tool-row git-branch-row"
              // The field keeps its focus and its caret through a click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(name)}
              title={name}
              style={{
                display: 'block',
                width: '100%',
                // The name starts where the typed text does: the field's own inset.
                padding: '3px 12px',
                border: 'none',
                borderRadius: token.borderRadiusSM,
                background: index === highlighted ? token.controlItemBgActive : undefined,
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: GIT_TEXT_SIZE,
                color: token.colorText,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              data-testid="git-tool-chip-branch-suggestion"
              data-ref={name}
              data-active={index === highlighted}
            >
              <MatchedText text={name} ranges={matcher.kind === 'match' ? matcher.ranges : undefined} />
            </button>
          ))}
        </div>
      )}
      {unknown.length > 0 && (
        <div style={{ ...note, color: token.colorError }} data-testid="git-tool-chip-branch-select-unknown">
          {t('workbench.gitLog.select.unknown', { names: unknown.join(', ') })}
        </div>
      )}
      <div style={{ ...note, color: token.colorTextTertiary }} data-testid="git-tool-chip-branch-select-hint">
        {t('workbench.gitLog.select.hint', { key: isMac ? '⌘↵' : 'Ctrl+Enter' })}
      </div>
    </div>
  );
};

export default BranchScopeField;
