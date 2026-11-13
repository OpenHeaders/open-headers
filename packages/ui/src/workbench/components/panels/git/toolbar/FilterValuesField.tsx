/**
 * FilterValuesField — a filter chip's Select…: a field that takes
 * SEVERAL values, one a line (and, where a value cannot hold one,
 * separated by a bar) — the reference's reading, shared by the Branch,
 * User and Paths chips. Typing a word lists the names that hold it,
 * what matched painted; Enter writes the highlighted one over the word
 * and moves the caret to a new line, the arrows move the highlight; the
 * finishing chord applies every value. A field that takes names ALONE
 * keeps itself open over a value that is none and names it. It opens
 * holding the values as they stand, and is as tall as its lines — the
 * suggestions sit directly under what is being typed, the hint under
 * them.
 */

import { Input, theme } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type React from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { GIT_TEXT_SIZE } from '../git-type-scale';
import MatchedText from '../MatchedText';
import { fieldSuggestions, fieldValues, unknownValues, withSuggestion, wordAtCaret } from './filter-values';
import { makeTextMatcher } from './log-filters';

export interface FilterValuesFieldProps {
  /** The names a typed word may become — the completion's list. */
  names: readonly string[];
  /** The values as they stand — what the field opens holding. */
  values: readonly string[];
  /** A bar separates values too (refs, authors); off, only a line break does (paths). */
  bar: boolean;
  /** The field takes `names` alone: a value that is none keeps it open and is named. */
  strict: boolean;
  /** The finishing chord. */
  onFinish: (values: string[]) => void;
  /** The root's testid; the field, the hint, the error and a suggestion take it as their prefix. */
  testid: string;
}

const FIELD_WIDTH = 340;

const FilterValuesField: React.FC<FilterValuesFieldProps> = ({ names, values, bar, strict, onFinish, testid }) => {
  const t = useT();
  const { token } = theme.useToken();
  const fieldRef = useRef<TextAreaRef>(null);
  const [text, setText] = useState(() => (values.length === 0 ? '' : `${values.join('\n')}\n`));
  const [caret, setCaret] = useState(text.length);
  const [active, setActive] = useState(0);
  const [unknown, setUnknown] = useState<readonly string[]>([]);
  // Where the caret goes once a text is in the field: after the values
  // it opens holding, then after each pick.
  const [placed, setPlaced] = useState<number | null>(text.length);

  useLayoutEffect(() => {
    if (placed === null) return;
    fieldRef.current?.resizableTextArea?.textArea.setSelectionRange(placed, placed);
    setPlaced(null);
  }, [placed]);

  const suggestions = useMemo(() => fieldSuggestions(text, caret, names, bar), [text, caret, names, bar]);
  const highlighted = Math.min(active, suggestions.length - 1);
  const matcher = useMemo(
    () => makeTextMatcher(wordAtCaret(text, caret, bar).typed, false, false),
    [text, caret, bar],
  );

  const pick = (name: string): void => {
    const next = withSuggestion(text, caret, name, bar);
    setText(next.text);
    setCaret(next.caret);
    setPlaced(next.caret);
    setActive(0);
    setUnknown([]);
  };

  const finish = (): void => {
    const named = fieldValues(text, bar);
    const missing = strict ? unknownValues(named, names) : [];
    if (missing.length > 0) setUnknown(missing);
    else onFinish(named);
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
  const chord = isMac ? '⌘↵' : 'Ctrl+Enter';

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 4, width: FIELD_WIDTH, padding: 8 }}
      data-testid={testid}
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
        data-testid={`${testid}-field`}
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
              data-testid={`${testid}-suggestion`}
              data-ref={name}
              data-active={index === highlighted}
            >
              <MatchedText text={name} ranges={matcher.kind === 'match' ? matcher.ranges : undefined} />
            </button>
          ))}
        </div>
      )}
      {unknown.length > 0 && (
        <div style={{ ...note, color: token.colorError }} data-testid={`${testid}-unknown`}>
          {t('workbench.gitLog.select.unknown', { names: unknown.join(', ') })}
        </div>
      )}
      <div style={{ ...note, color: token.colorTextTertiary }} data-testid={`${testid}-hint`}>
        {t(bar ? 'workbench.gitLog.select.hint' : 'workbench.gitLog.select.hintLines', { key: chord })}
      </div>
    </div>
  );
};

export default FilterValuesField;
