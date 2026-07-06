/**
 * RequestUrlBar — the method picker + URL input that lives in the
 * editor header's title slot. Owns the bidirectional URL↔Params sync:
 * editing the URL re-parses its query into the params table (preserving
 * row metadata via `mergeParamsFromUrl`), and the displayed value folds
 * the structured params back in via `buildUrlDisplay`. On blur it
 * normalizes a scheme-less URL to `https://`.
 */

import { DeleteOutlined } from '@ant-design/icons';
import { EntityField, REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import type { HttpMethod } from '@openheaders/core/types';
import { buildUrlDisplay, parseUrlQuery } from '@openheaders/core/utils';
import { Select } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ensureScheme, needsSchemeNormalization } from '@openheaders/ui/shared/fetch';
import { METHOD_COLORS } from '../sidebar/icons';
import { type Draft, draftParamsToQueryParams, mergeParamsFromUrl } from './draft';
import { TemplateInput } from '../template-input';

const METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** Well-known non-core verbs surfaced only while searching, so the
 *  default list stays short but PROPFIND/PURGE users find theirs. */
const EXTENDED_METHODS: readonly string[] = ['COPY', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND', 'VIEW'];

// Mirrors core's HttpMethodSchema: uppercase token, fetch-forbidden verbs excluded.
const METHOD_TOKEN = /^[A-Z][A-Z0-9-]{0,31}$/;
const FORBIDDEN_METHODS = new Set(['CONNECT', 'TRACE', 'TRACK']);

const CUSTOM_METHODS_KEY = 'oh.customHttpMethods';

function readCustomMethods(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CUSTOM_METHODS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

function persistCustomMethods(methods: readonly string[]): void {
  try {
    window.localStorage.setItem(CUSTOM_METHODS_KEY, JSON.stringify(methods));
  } catch {
    // Storage unavailable — customs last for this session only.
  }
}

// Colored labels so the dropdown menu reads like the tree and the
// trigger — antd renders the same node in both places. Custom methods
// fall back to the neutral secondary tint.
const methodLabel = (m: string): React.ReactNode => (
  <span style={{ fontWeight: 700, color: METHOD_COLORS[m] ?? 'var(--ant-color-text-secondary)', fontSize: 12 }}>
    {m}
  </span>
);

interface MethodOption {
  value: string;
  label: React.ReactNode;
  /** User-added — renders with a remove affordance. */
  custom?: boolean;
}

interface RequestUrlBarProps {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  /** True when the URL string carries an unresolved `{{ref}}`. */
  urlUnresolved: boolean;
  /** Fired on Enter inside the URL field. */
  onSend: () => void;
}

const RequestUrlBar: React.FC<RequestUrlBarProps> = ({ draft, setDraft, urlUnresolved, onSend }) => {
  const [customMethods, setCustomMethods] = useState<string[]>(readCustomMethods);
  const [methodSearch, setMethodSearch] = useState('');

  const removeCustomMethod = (method: string): void => {
    setCustomMethods((prev) => {
      const next = prev.filter((m) => m !== method);
      persistCustomMethods(next);
      return next;
    });
  };

  // Default list = the seven verbs + saved customs. Searching widens the
  // pool to the extended verbs; a typed token that matches nothing gets
  // a trailing "Use …" entry so any custom method is one Enter away.
  const methodOptions = useMemo<MethodOption[]>(() => {
    const q = methodSearch.trim().toUpperCase();
    const base: string[] = [...METHODS, ...customMethods.filter((m) => !METHODS.includes(m as HttpMethod))];
    const pool = q ? [...base, ...EXTENDED_METHODS.filter((m) => !base.includes(m))] : base;
    const visible = q ? pool.filter((m) => m.includes(q)) : pool;
    const options: MethodOption[] = visible.map((m) => ({
      value: m,
      label: methodLabel(m),
      custom: customMethods.includes(m),
    }));
    if (q && METHOD_TOKEN.test(q) && !FORBIDDEN_METHODS.has(q) && !visible.includes(q)) {
      options.push({
        value: q,
        label: (
          <span style={{ fontSize: 12 }}>
            Use <strong>{q}</strong>
          </span>
        ),
      });
    }
    return options;
  }, [methodSearch, customMethods]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <EntityField path={REQUEST_PATHS.method}>
        <Select
          value={draft.method}
          onChange={(method: string) => {
            if (!METHODS.includes(method as HttpMethod) && !customMethods.includes(method)) {
              const next = [...customMethods, method];
              setCustomMethods(next);
              persistCustomMethods(next);
            }
            setDraft((d) => ({ ...d, method }));
          }}
          options={methodOptions}
          optionRender={(option) =>
            option.data.custom ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {option.label}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: inline remove affordance inside an option row */}
                <DeleteOutlined
                  aria-label={`Remove custom method ${String(option.value)}`}
                  style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeCustomMethod(String(option.value));
                  }}
                />
              </span>
            ) : (
              option.label
            )
          }
          showSearch
          // Hide the selected label while a query is being typed — the
          // search input and the label share the same box, and the
          // colored label node otherwise stays painted under the text.
          labelRender={({ label }) => <span style={{ opacity: methodSearch ? 0 : 1 }}>{label}</span>}
          searchValue={methodSearch}
          onSearch={(next) => setMethodSearch(next.toUpperCase())}
          filterOption={false}
          onOpenChange={(open) => {
            if (!open) setMethodSearch('');
          }}
          size="small"
          style={{ width: 96, flexShrink: 0 }}
          popupMatchSelectWidth={false}
        />
      </EntityField>
      <EntityField path={REQUEST_PATHS.url}>
        <TemplateInput
          value={buildUrlDisplay(draft.url, draftParamsToQueryParams(draft.params))}
          onChange={(next) => {
            const parsed = parseUrlQuery(next);
            setDraft((d) => ({
              ...d,
              url: parsed.base,
              params: mergeParamsFromUrl(parsed.params, d.params),
            }));
          }}
          placeholder="Enter URL or paste text"
          size="small"
          status={urlUnresolved ? 'error' : undefined}
          flagUnresolved
          // Same treatment as the request table's cells: a long URL shows
          // an ellipsis when idle and, on focus, word-wraps + auto-grows
          // (up to ~5 rows, then inner-scrolls) so it's comfortably
          // editable. The header grows with it (see `.rules-editor-header`
          // min-height). Single-line semantics stay — Enter still sends.
          expandOnFocus
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "'SF Mono', monospace",
            fontSize: 12,
            // Fill the 24px min-height so the text sits on the vertical
            // center. The component's default `lineHeight: 1.5714` combined
            // with monospace metrics pushes glyphs slightly above center.
            lineHeight: '22px',
          }}
          onPressEnter={onSend}
          onBlur={() => {
            const trimmed = draft.url.trim();
            if (trimmed.length > 0 && needsSchemeNormalization(trimmed)) {
              const normalized = ensureScheme(trimmed);
              if (normalized !== draft.url) {
                setDraft((d) => ({ ...d, url: normalized }));
              }
            }
          }}
        />
      </EntityField>
    </div>
  );
};

export default RequestUrlBar;
