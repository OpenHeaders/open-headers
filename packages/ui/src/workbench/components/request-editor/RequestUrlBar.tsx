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
import { METHOD_COLORS } from '../sidebar/icons';
import { type Draft, draftParamsToQueryParams, mergeParamsFromUrl } from './draft';
import { TemplateInput } from '../template-input';

const METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// Colored option labels so the dropdown menu reads like the tree and
// the trigger — antd renders the same node in both places, so no
// separate labelRender is needed.
const METHOD_OPTIONS: { value: HttpMethod; label: React.ReactNode }[] = METHODS.map((m) => ({
  value: m,
  label: <span style={{ fontWeight: 700, color: METHOD_COLORS[m] ?? '#999', fontSize: 12 }}>{m}</span>,
}));

interface RequestUrlBarProps {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  /** True when the URL string carries an unresolved `{{ref}}`. */
  urlUnresolved: boolean;
  /** Fired on Enter inside the URL field. */
  onSend: () => void;
}

const RequestUrlBar: React.FC<RequestUrlBarProps> = ({ draft, setDraft, urlUnresolved, onSend }) => {
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
