const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'xhr', label: 'Fetch/XHR' },
  { key: 'doc', label: 'Doc' },
  { key: 'css', label: 'CSS' },
  { key: 'js', label: 'JS' },
  { key: 'font', label: 'Font' },
  { key: 'img', label: 'Img' },
  { key: 'media', label: 'Media' },
  { key: 'manifest', label: 'Manifest' },
  { key: 'ws', label: 'Socket' },
  { key: 'wasm', label: 'Wasm' },
  { key: 'other', label: 'Other' },
];

interface ResourceFilterProps {
  value: ReadonlySet<string>;
  onChange: (value: Set<string>) => void;
}

export function ResourceFilter({ value, onChange }: ResourceFilterProps) {
  const isAll = value.size === 0;

  const handleClick = (key: string) => {
    if (key === 'all') {
      onChange(new Set());
      return;
    }
    const next = new Set(value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  return (
    <div className="dt-filter-pills">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          className="dt-filter-pill"
          data-active={f.key === 'all' ? isAll : value.has(f.key)}
          onClick={() => handleClick(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
