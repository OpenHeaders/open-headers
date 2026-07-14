import { useRef } from 'react';
import type { TextMatchConfig } from '../data/text-match';

/**
 * The one filter input every panel surface renders — text field with
 * the three standard match toggles (Aa / ab / .*) and a clear (×)
 * button that appears once there is text. Generic over the config so
 * surfaces with wider configs (the network `FilterConfig`) can pass
 * their state object straight through.
 */
interface FilterInputProps<C extends TextMatchConfig> {
  value: string;
  onChange: (value: string) => void;
  config: C;
  onConfigChange: (config: C) => void;
  hasError: boolean;
  placeholder?: string;
  ariaLabel?: string;
  /** Optional additional keydown handler — runs after the Alt+C/W/R bindings. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function FilterInput<C extends TextMatchConfig>({
  value,
  onChange,
  config,
  onConfigChange,
  hasError,
  placeholder,
  ariaLabel,
  onKeyDown,
}: FilterInputProps<C>) {
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (key: keyof TextMatchConfig) => {
    onConfigChange({ ...config, [key]: !config[key] });
  };

  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey && e.key === 'c') {
      e.preventDefault();
      toggle('matchCase');
      return;
    }
    if (e.altKey && e.key === 'w') {
      e.preventDefault();
      toggle('wholeWord');
      return;
    }
    if (e.altKey && e.key === 'r') {
      e.preventDefault();
      toggle('regexMode');
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`dt-filter-input-wrap${value ? ' dt-filter-input-wrap--clearable' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        className={`dt-filter-input ${hasError ? 'dt-filter-input--error' : ''}`}
        placeholder={placeholder ?? 'Filter'}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="dt-filter-input-toggles">
        {value && (
          <button type="button" className="dt-filter-clear" onClick={clear} title="Clear" aria-label="Clear filter">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="5.2" fill="currentColor" />
              <path d="M4 4l4 4M8 4l-4 4" stroke="var(--dt-input-bg)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="dt-filter-toggle"
          data-active={config.matchCase}
          onClick={() => toggle('matchCase')}
          title="Match Case (Alt+C)"
        >
          Aa
        </button>
        <button
          type="button"
          className="dt-filter-toggle"
          data-active={config.wholeWord}
          onClick={() => toggle('wholeWord')}
          title="Match Whole Word (Alt+W)"
        >
          ab
        </button>
        <button
          type="button"
          className="dt-filter-toggle"
          data-active={config.regexMode}
          onClick={() => toggle('regexMode')}
          title="Use Regular Expression (Alt+R)"
        >
          .*
        </button>
      </div>
    </div>
  );
}
