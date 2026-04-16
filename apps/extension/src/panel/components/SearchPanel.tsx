import { useMemo, useState } from 'react';
import type { FilterConfig } from '../data/filter-engine';
import { DEFAULT_FILTER_CONFIG } from '../data/filter-engine';
import type { InspectorRequest } from '../data/types';
import { FilterInput } from './FilterInput';

interface SearchPanelProps {
  entries: readonly InspectorRequest[];
  onClose: () => void;
  onResultClick: (entryId: string, highlight: string, section: string, lineNumber: number) => void;
  docsActive: boolean;
  onToggleDocs: () => void;
}

interface SearchMatch {
  lineNumber: number;
  lineText: string;
  section: string;
}

interface SearchGroup {
  entryId: string;
  filename: string;
  origin: string;
  timestamp: string;
  matches: SearchMatch[];
}

function extractFilename(url: string): { filename: string; origin: string } {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const filename = segments.length > 0 ? segments[segments.length - 1] : parsed.hostname;
    return { filename, origin: parsed.hostname + parsed.pathname };
  } catch {
    return { filename: url, origin: url };
  }
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function buildSearchableText(entry: InspectorRequest): Array<{ text: string; section: string }> {
  const parts: Array<{ text: string; section: string }> = [];
  const har = entry.harEntry;

  const general = [entry.url, `${entry.method} ${entry.statusCode ?? ''} ${entry.statusText ?? ''}`].join('\n');
  parts.push({ text: general, section: 'General' });

  const reqHeaders = har.request?.headers;
  if (reqHeaders && reqHeaders.length > 0) {
    parts.push({
      text: reqHeaders.map((h) => `${h.name}: ${h.value}`).join('\n'),
      section: 'Request Headers',
    });
  }

  const resHeaders = har.response?.headers;
  if (resHeaders && resHeaders.length > 0) {
    parts.push({
      text: resHeaders.map((h) => `${h.name}: ${h.value}`).join('\n'),
      section: 'Response Headers',
    });
  }

  const qs = har.request?.queryString;
  if (qs && qs.length > 0) {
    parts.push({
      text: qs.map((q) => `${q.name}=${q.value}`).join('\n'),
      section: 'Query Params',
    });
  }

  const postData = har.request?.postData;
  if (postData?.text) {
    parts.push({ text: postData.text, section: 'Request Body' });
  }

  if (entry.responseBody) {
    parts.push({ text: entry.responseBody, section: 'Response' });
  }

  return parts;
}

function lineMatches(line: string, query: string, config: FilterConfig): boolean {
  if (config.regexMode) {
    try {
      const re = new RegExp(query, config.matchCase ? '' : 'i');
      return re.test(line);
    } catch {
      return false;
    }
  }

  const h = config.matchCase ? line : line.toLowerCase();
  const n = config.matchCase ? query : query.toLowerCase();

  if (config.wholeWord) {
    try {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, config.matchCase ? '' : 'i').test(line);
    } catch {
      return h.includes(n);
    }
  }

  return h.includes(n);
}

function searchInText(text: string, query: string, section: string, config: FilterConfig): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lineMatches(lines[i], query, config)) {
      matches.push({ lineNumber: i + 1, lineText: lines[i], section });
    }
  }
  return matches;
}

function highlightParts(text: string, query: string, config: FilterConfig): Array<{ text: string; hl: boolean }> {
  if (!query) return [{ text, hl: false }];

  if (config.regexMode) {
    try {
      const re = new RegExp(`(${query})`, config.matchCase ? 'g' : 'gi');
      const parts: Array<{ text: string; hl: boolean }> = [];
      let lastIndex = 0;
      for (const match of text.matchAll(re)) {
        const idx = match.index;
        if (idx > lastIndex) parts.push({ text: text.slice(lastIndex, idx), hl: false });
        parts.push({ text: match[0], hl: true });
        lastIndex = idx + match[0].length;
      }
      if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), hl: false });
      return parts.length > 0 ? parts : [{ text, hl: false }];
    } catch {
      return [{ text, hl: false }];
    }
  }

  const lower = config.matchCase ? text : text.toLowerCase();
  const needle = config.matchCase ? query : query.toLowerCase();
  const parts: Array<{ text: string; hl: boolean }> = [];
  let pos = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(needle, pos);
    if (idx === -1) {
      parts.push({ text: text.slice(pos), hl: false });
      break;
    }
    if (idx > pos) parts.push({ text: text.slice(pos, idx), hl: false });
    parts.push({ text: text.slice(idx, idx + query.length), hl: true });
    pos = idx + query.length;
  }
  return parts;
}

function HighlightedText({ text, query, config }: { text: string; query: string; config: FilterConfig }) {
  const parts = highlightParts(text, query, config);
  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <mark key={i} className="dt-search-highlight">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function SearchPanel({ entries, onClose, onResultClick, docsActive, onToggleDocs }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [config, setConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);

  const hasError = useMemo(() => {
    if (!config.regexMode || !query.trim()) return false;
    try {
      new RegExp(query.trim());
      return false;
    } catch {
      return true;
    }
  }, [query, config.regexMode]);

  const results = useMemo<SearchGroup[]>(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    if (hasError) return [];
    const groups: SearchGroup[] = [];
    for (const entry of entries) {
      const sections = buildSearchableText(entry);
      const allMatches: SearchMatch[] = [];
      for (const { text, section } of sections) {
        const matches = searchInText(text, q, section, config);
        for (const m of matches) allMatches.push(m);
      }
      if (allMatches.length === 0) continue;
      const { filename, origin } = extractFilename(entry.url);
      groups.push({
        entryId: entry.id,
        filename,
        origin,
        timestamp: formatTimestamp(entry.timestamp),
        matches: allMatches,
      });
    }
    return groups;
  }, [entries, query, config, hasError]);

  const totalMatches = results.reduce((sum, g) => sum + g.matches.length, 0);
  const totalFiles = results.length;

  return (
    <div className="dt-search-panel">
      <div className="dt-search-panel-header">
        <span className="dt-search-panel-title">Search</span>
        <button type="button" className="dt-tab-close" onClick={onClose} title="Close search">
          {'\u00d7'}
        </button>
      </div>
      <div className="dt-search-panel-input-row">
        <FilterInput
          value={query}
          onChange={setQuery}
          config={config}
          onConfigChange={setConfig}
          hasError={hasError}
          placeholder="Search"
        />
        <button
          type="button"
          className="dt-toolbar-icon"
          data-active={docsActive}
          onClick={onToggleDocs}
          title="Filter syntax help"
        >
          <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <text
              x="8"
              y="12"
              textAnchor="middle"
              fill="currentColor"
              fontSize="10"
              fontFamily="serif"
              fontStyle="italic"
            >
              i
            </text>
          </svg>
        </button>
      </div>
      <div className="dt-search-panel-results">
        {query.trim().length >= 2 && !hasError && results.length === 0 && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            No matches found.
          </div>
        )}
        {results.map((group) => (
          <details key={group.entryId} className="dt-search-group" open>
            <summary>
              <span className="dt-search-group-time">{group.timestamp}</span>
              <span className="dt-search-group-file">{group.filename}</span>
              <span className="dt-search-group-origin">{group.origin}</span>
            </summary>
            {group.matches.slice(0, 50).map((m, i) => (
              <button
                key={`${m.section}-${m.lineNumber}-${i}`}
                type="button"
                className="dt-search-match"
                onClick={() => onResultClick(group.entryId, query.trim(), m.section, m.lineNumber)}
              >
                <span className="dt-search-match-line">{m.lineNumber}</span>
                <span className="dt-search-match-text">
                  <HighlightedText text={m.lineText.slice(0, 200)} query={query.trim()} config={config} />
                </span>
                <span className="dt-search-match-section">{m.section}</span>
              </button>
            ))}
          </details>
        ))}
      </div>
      {query.trim().length >= 2 && !hasError && (
        <div className="dt-search-panel-status">
          {totalMatches > 0
            ? `Search finished. Found ${totalMatches} matching line${totalMatches === 1 ? '' : 's'} in ${totalFiles} file${totalFiles === 1 ? '' : 's'}.`
            : 'No results.'}
        </div>
      )}
    </div>
  );
}
