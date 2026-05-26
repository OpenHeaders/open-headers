/**
 * RawDataView — the "Raw Data" detail section.
 *
 * Two stacked bands:
 *
 *   1. Snippet generator. Pick a format (curl, fetch, python, …), tick
 *      the include / redact / rule-mode toggles, and copy the result.
 *      Defaults are conservative (redact ON; post-rule values) so that
 *      a one-click copy → paste doesn't leak a bearer token.
 *
 *   2. Raw JSON tree. Full HAR entry, collapsible. The power-user
 *      fallback for fields we don't surface elsewhere. Curated metadata
 *      (protocol, remote IP, priority, …) lives in Headers > General,
 *      not here — duplicating it would just split user attention.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Popover } from 'antd';
import { useMemo, useState } from 'react';
import { buildHarFromEntries } from '../../data/har-export';
import type { AnnotatedHeader } from '../../data/header-attribution';
import {
  currentHarEntry,
  type InspectorRowWithFires,
  resolvePageref,
} from '../../data/inspector-row-projection';
import { maybeRedactHeaderValue } from './raw-data/redact';
import { generateSnippet, SNIPPET_FORMATS, type SnippetFormat } from './raw-data/snippet-generators';
import TextBodyViewer from './TextBodyViewer';

const HAR_INFO: InfoPopoverContent = {
  kicker: 'Format',
  title: 'HAR 1.2',
  summary: 'Portable HTTP Archive — a JSON snapshot of one request.',
  description:
    'Save it to attach to a bug report, share with a teammate, or import into another tool that reads HAR files.',
};

interface RawDataViewProps {
  row: InspectorRowWithFires;
  /** Post-rule, annotated request headers from the parent. We only use
   *  the annotation to derive pre-rule ("original") values when the
   *  rule-mode toggle is flipped — the post-rule snippet reads directly
   *  off the current HAR entry. */
  requestHeaders: readonly AnnotatedHeader[];
  /** All known pages from the page-stream snapshot. Only the entry's
   *  resolved `pageref` survives into the exported envelope. */
  pages: readonly Page[];
}

interface HeaderPair {
  name: string;
  value: string;
}

type RuleMode = 'post' | 'original';

function derivePostRuleHeaders(har: InspectorHarEntry | null): HeaderPair[] {
  return (har?.request?.headers ?? []).map((h) => ({ name: h.name, value: h.value }));
}

function deriveOriginalHeaders(annotated: readonly AnnotatedHeader[]): HeaderPair[] {
  const out: HeaderPair[] = [];
  for (const h of annotated) {
    const a = h.attribution;
    if (a.kind === 'server' || a.kind === 'system') {
      out.push({ name: h.name, value: h.value });
    } else if (a.kind === 'modified') {
      out.push({ name: h.name, value: a.originalValue });
    } else if (a.kind === 'removed' && a.source === 'server') {
      out.push({ name: h.name, value: a.originalValue });
    }
    // skipped: `added`, `removed/rule-cancelled` — neither existed pre-rule.
  }
  return out;
}

function applyRedaction(headers: readonly HeaderPair[], redact: boolean): HeaderPair[] {
  if (!redact) return headers.slice();
  return headers.map((h) => ({ name: h.name, value: maybeRedactHeaderValue(h.name, h.value, true) }));
}

export default function RawDataView({ row, requestHeaders, pages }: RawDataViewProps) {
  const lc = row.lifecycle;
  const har = currentHarEntry(lc);
  const pageref = useMemo(() => resolvePageref(lc, pages) ?? undefined, [lc, pages]);

  const [format, setFormat] = useState<SnippetFormat>('curl-unix');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeBody, setIncludeBody] = useState(true);
  const [redact, setRedact] = useState(true);
  const [ruleMode, setRuleMode] = useState<RuleMode>('post');
  const [copied, setCopied] = useState(false);
  const [harCopied, setHarCopied] = useState(false);
  const [harOpen, setHarOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(true);

  const ruleFired = row.fires.length > 0;
  const hasBody = !!har?.request?.postData?.text;

  // Badge non-default toggles in the View menu — matches the Timing /
  // Headers / Cookies pattern, so the user always sees at a glance
  // whether the snippet output is shaped by their tweaks.
  const viewActiveCount =
    (includeHeaders ? 0 : 1) +
    (hasBody && !includeBody ? 1 : 0) +
    (redact ? 0 : 1) +
    (ruleFired && ruleMode === 'original' ? 1 : 0);

  const headersForSnippet = useMemo<HeaderPair[]>(() => {
    const base = ruleMode === 'original' ? deriveOriginalHeaders(requestHeaders) : derivePostRuleHeaders(har);
    return applyRedaction(base, redact);
  }, [ruleMode, requestHeaders, har, redact]);

  const snippet = useMemo(
    () =>
      har
        ? generateSnippet({
            harEntry: har,
            headers: headersForSnippet,
            format,
            includeHeaders,
            includeBody,
            pageref,
            pages,
          })
        : '(no request data yet)',
    [har, headersForSnippet, format, includeHeaders, includeBody, pageref, pages],
  );

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail under permission-restricted iframes — fall back
      // to a transient selection so the user can Cmd+C manually.
    }
  };

  const harJson = useMemo(
    () =>
      har
        ? JSON.stringify(buildHarFromEntries([{ harEntry: har, pageref }], pages), null, 2)
        : '{}',
    [har, pageref, pages],
  );

  const copyHar = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(harJson);
      setHarCopied(true);
      window.setTimeout(() => setHarCopied(false), 1500);
    } catch {
      // see above — restricted-iframe fallback handled by the user.
    }
  };

  const downloadHar = (): void => {
    const blob = new Blob([harJson], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let host = 'request';
    try {
      host = new URL(lc.url).hostname || host;
    } catch {
      // leave default
    }
    a.download = `${host}-${row.displayId}.har`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="dt-rawdata-view">
      <details
        className="dt-section dt-rawdata-export"
        open={exportOpen}
        onToggle={(e) => setExportOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <span className="dt-rawdata-summary-label">Export snippet</span>
          <span
            className="dt-rawdata-summary-controls"
            onClick={(e) => e.stopPropagation()}
          >
          <label className="dt-rawdata-field">
            <span className="dt-rawdata-field-label">Format</span>
            <select
              className="dt-rawdata-select"
              value={format}
              onChange={(e) => setFormat(e.target.value as SnippetFormat)}
            >
              {SNIPPET_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <span className="dt-rawdata-actions">
            <Popover
              content={
                <div className="dt-morefilters-menu">
                  <label className="dt-morefilters-item">
                    <input
                      type="checkbox"
                      checked={includeHeaders}
                      onChange={(e) => setIncludeHeaders(e.target.checked)}
                    />
                    Include request headers
                  </label>
                  <label
                    className={`dt-morefilters-item${hasBody ? '' : ' dt-morefilters-item--disabled'}`}
                  >
                    <input
                      type="checkbox"
                      checked={includeBody && hasBody}
                      disabled={!hasBody}
                      onChange={(e) => setIncludeBody(e.target.checked)}
                    />
                    Include request body
                  </label>
                  <label className="dt-morefilters-item">
                    <input
                      type="checkbox"
                      checked={redact}
                      onChange={(e) => setRedact(e.target.checked)}
                    />
                    Redact secrets
                  </label>
                  {ruleFired && (
                    <>
                      <div className="dt-morefilters-divider" />
                      <div className="dt-sortmode-heading">Rule-modified headers</div>
                      <label className="dt-morefilters-item">
                        <input
                          type="radio"
                          name="rule-mode"
                          checked={ruleMode === 'post'}
                          onChange={() => setRuleMode('post')}
                        />
                        Post-rule (on the wire)
                      </label>
                      <label className="dt-morefilters-item">
                        <input
                          type="radio"
                          name="rule-mode"
                          checked={ruleMode === 'original'}
                          onChange={() => setRuleMode('original')}
                        />
                        Original (before rules)
                      </label>
                    </>
                  )}
                </div>
              }
              trigger="click"
              placement="bottomRight"
              arrow={false}
              overlayClassName="dt-morefilters-popover"
            >
              <button
                type="button"
                className={`dt-toolbar-dropdown${viewActiveCount > 0 ? ' dt-toolbar-dropdown--active' : ''}`}
              >
                View
                {viewActiveCount > 0 && <span className="dt-toolbar-dropdown-count">{viewActiveCount}</span>}
                <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
            </Popover>
            <button type="button" className="dt-payload-toggle-btn" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="dt-payload-toggle-btn" onClick={downloadHar}>
              Save as .har
            </button>
          </span>
          </span>
        </summary>

      </details>

      {exportOpen && (
        <div className="dt-rawdata-export-body">
          <pre className="dt-rawdata-snippet">{snippet}</pre>
        </div>
      )}

      <details
        className={`dt-section dt-rawdata-har${harOpen ? '' : ' dt-rawdata-har--closed'}`}
        open={harOpen}
        onToggle={(e) => setHarOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <span className="dt-rawdata-summary-label">Raw HAR (JSON)</span>
          <InfoTrigger content={HAR_INFO} />
          <span
            className="dt-rawdata-summary-controls"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="dt-payload-toggle-btn" onClick={copyHar}>
              {harCopied ? 'Copied' : 'Copy JSON'}
            </button>
            <button type="button" className="dt-payload-toggle-btn" onClick={downloadHar}>
              Download .har
            </button>
          </span>
        </summary>
      </details>

      {harOpen && (
        <div className="dt-rawdata-har-viewer">
          <TextBodyViewer text={harJson} declaredMime="application/json" />
        </div>
      )}
    </div>
  );
}
