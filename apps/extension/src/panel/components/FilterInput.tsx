import type { FilterConfig } from '../data/filter-engine';

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  config: FilterConfig;
  onConfigChange: (config: FilterConfig) => void;
  hasError: boolean;
  placeholder?: string;
  /** Optional additional keydown handler — runs after the Alt+C/W/R bindings. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function FilterInput({
  value,
  onChange,
  config,
  onConfigChange,
  hasError,
  placeholder,
  onKeyDown,
}: FilterInputProps) {
  const toggle = (key: keyof FilterConfig) => {
    onConfigChange({ ...config, [key]: !config[key] });
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
    <div className="dt-filter-input-wrap">
      <input
        type="text"
        className={`dt-filter-input ${hasError ? 'dt-filter-input--error' : ''}`}
        placeholder={placeholder ?? 'Filter'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="dt-filter-input-toggles">
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
