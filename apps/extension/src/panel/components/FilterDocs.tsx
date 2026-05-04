import { useMemo } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@/shared/dock-layout';

interface FilterDocsProps {
  onClose: () => void;
}

export function FilterDocs({ onClose }: FilterDocsProps) {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  return (
    <div className="dt-panel">
      <PanelHeader wiring={wiring} title={<strong>Filter Syntax</strong>} />
      <div className="dt-panel-body dt-filter-docs">
        <details className="dt-section" open>
          <summary>Text Filters</summary>
          <div className="dt-filter-docs-row">
            <code>example.com</code>
            <span>Show requests whose URL contains &ldquo;example.com&rdquo;</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>-analytics</code>
            <span>Hide requests matching &ldquo;analytics&rdquo;</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>"exact phrase"</code>
            <span>Match an exact phrase (use quotes for spaces)</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>api -fonts</code>
            <span>Multiple terms are AND-ed together</span>
          </div>
        </details>

        <details className="dt-section" open>
          <summary>Property Filters</summary>
          <div className="dt-filter-docs-row">
            <code>domain:example.com</code>
            <span>Match hostname</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>status-code:404</code>
            <span>Exact status code</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>method:POST</code>
            <span>HTTP method (case-insensitive)</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>mime-type:json</code>
            <span>Match MIME type substring</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>has-response-header:x-cache</code>
            <span>Response header exists</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>larger-than:10k</code>
            <span>Response size &gt; N bytes (k, M suffixes)</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>is:from-cache</code>
            <span>Cached responses (304 or from-cache flag)</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>-domain:ads.com</code>
            <span>
              Negate any property with <code>-</code> prefix
            </span>
          </div>
        </details>

        <details className="dt-section" open>
          <summary>Toggle Buttons</summary>
          <div className="dt-filter-docs-row">
            <code>Aa</code>
            <span>Match Case &mdash; case-sensitive matching (Alt+C)</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>ab</code>
            <span>Whole Word &mdash; match word boundaries only (Alt+W)</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>.*</code>
            <span>Regex &mdash; treat input as a regular expression (Alt+R)</span>
          </div>
        </details>

        <details className="dt-section" open>
          <summary>Examples</summary>
          <div className="dt-filter-docs-row">
            <code>domain:api.example.com method:POST</code>
            <span>POST requests to api.example.com</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>-domain:analytics.com -.js</code>
            <span>Hide analytics and JS files</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>larger-than:1M mime-type:image</code>
            <span>Images larger than 1 MB</span>
          </div>
          <div className="dt-filter-docs-row">
            <code>status-code:500</code>
            <span>Server errors only</span>
          </div>
        </details>
      </div>
    </div>
  );
}
