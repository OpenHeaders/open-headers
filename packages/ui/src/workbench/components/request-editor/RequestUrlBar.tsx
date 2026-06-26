/**
 * RequestUrlBar — the method picker + URL input that lives in the
 * editor header's title slot. Owns the bidirectional URL↔Params sync:
 * editing the URL re-parses its query into the params table (preserving
 * row metadata via `mergeParamsFromUrl`), and the displayed value folds
 * the structured params back in via `buildUrlDisplay`. On blur it
 * normalizes a scheme-less URL to `https://`.
 */

import { EntityField, REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import type { HttpMethod } from '@openheaders/core/types';
import { buildUrlDisplay, parseUrlQuery } from '@openheaders/core/utils';
import { Select } from 'antd';
import type React from 'react';
import { ensureScheme, needsSchemeNormalization } from '@openheaders/ui/shared/fetch';
import { type Draft, draftParamsToQueryParams, mergeParamsFromUrl } from './draft';
import { TemplateInput } from '../template-input';

const METHOD_OPTIONS: { value: HttpMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

interface RequestUrlBarProps {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  /** True when the URL string carries an unresolved `{{ref}}`. */
  urlUnresolved: boolean;
  /** Fired on Enter inside the URL field. */
  onSend: () => void;
}

const RequestUrlBar: React.FC<RequestUrlBarProps> = ({ draft, setDraft, urlUnresolved, onSend }) => {
  const methodColor = METHOD_COLORS[draft.method] ?? '#999';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <EntityField path={REQUEST_PATHS.method}>
        <Select
          value={draft.method}
          onChange={(method) => setDraft((d) => ({ ...d, method }))}
          options={METHOD_OPTIONS}
          size="small"
          style={{ width: 96, flexShrink: 0 }}
          popupMatchSelectWidth={false}
          labelRender={({ label }) => <span style={{ fontWeight: 700, color: methodColor, fontSize: 12 }}>{label}</span>}
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
