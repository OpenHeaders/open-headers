/**
 * ComboKnob — a preset-plus-free-entry combo field (the "select or
 * add" pattern): one control that offers a curated preset list while
 * empty, and interprets whatever the user types into concrete
 * candidates to pick from ("10" → "10 s" / "10 min"). A committed
 * value re-renders through `format` as a human label; clearing (or
 * emptying) returns the knob to its default (`undefined`), whose
 * effective behavior the placeholder states.
 *
 * Commit rules: picking a candidate commits it; Enter commits the
 * first enabled candidate for the current text; blur commits an
 * unambiguous single enabled candidate, empties back to the default,
 * and otherwise reverts to the last committed value — free text can
 * never land in the model uninterpreted. Disabled candidates are
 * feedback only (an interpreter explaining a rejected reading, e.g.
 * one outside the field's bounds): they render greyed in the dropdown
 * and can never commit.
 */
import { AutoComplete } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';

export interface ComboKnobOption<T> {
  value: T;
  label: string;
  /** Feedback-only candidate — shown greyed, never committable. */
  disabled?: boolean;
}

export interface ComboKnobProps<T> {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  /** Curated dropdown shown while the field is empty. */
  presets: ReadonlyArray<ComboKnobOption<T>>;
  /** Free text → concrete candidates; an empty result means the text
   *  is uninterpretable (it reverts on blur). Defaults to
   *  case-insensitive prefix filtering over the presets. */
  interpret?: (input: string) => ComboKnobOption<T>[];
  /** Committed value → display label. */
  format: (value: T) => string;
  /** Effective default, shown while no explicit value is set. */
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
  testId?: string;
}

function ComboKnob<T>({
  value,
  onChange,
  presets,
  interpret,
  format,
  placeholder,
  disabled,
  ariaLabel,
  size = 'small',
  style,
  testId,
}: ComboKnobProps<T>): React.ReactElement {
  /** Text being typed; undefined while showing the committed label. */
  const [text, setText] = useState<string | undefined>(undefined);
  const display = text ?? (value !== undefined ? format(value) : '');

  const candidates = useMemo<ComboKnobOption<T>[]>(() => {
    const trimmed = text?.trim() ?? '';
    if (trimmed === '') return [...presets];
    if (interpret) return interpret(trimmed);
    const needle = trimmed.toLowerCase();
    return presets.filter((p) => p.label.toLowerCase().startsWith(needle));
  }, [text, presets, interpret]);

  const committable = useMemo(() => candidates.filter((c) => c.disabled !== true), [candidates]);

  const commit = (label: string): boolean => {
    const hit = committable.find((c) => c.label === label);
    if (!hit) return false;
    onChange(hit.value);
    setText(undefined);
    return true;
  };

  return (
    <AutoComplete
      size={size}
      value={display}
      options={candidates.map((c) => ({ value: c.label, disabled: c.disabled }))}
      onSearch={(input) => setText(input)}
      onSelect={(label: string) => commit(label)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && text !== undefined && committable.length > 0) {
          commit(committable[0].label);
        }
      }}
      onClear={() => {
        onChange(undefined);
        setText(undefined);
      }}
      onBlur={() => {
        if (text === undefined) return;
        if (text.trim() === '') onChange(undefined);
        else if (committable.length === 1) commit(committable[0].label);
        setText(undefined);
      }}
      allowClear
      popupMatchSelectWidth={false}
      dropdownStyle={{ maxWidth: 320 }}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      data-testid={testId}
      style={style}
    />
  );
}

export default ComboKnob;
