/**
 * Metric-family filter laws: exposition parsing (family grouping,
 * histogram/summary siblings, escapes, malformed-line tolerance), the
 * hybrid query syntax (bare substring vs PromQL-style selector),
 * series-level matcher semantics (absent label = empty string),
 * mid-edit forgiveness vs closed-selector errors, verbatim output
 * (display never rewrites a source line), and contextual completions.
 *
 * The fixture mirrors the playground's deterministic `/api/metrics`
 * probe (`playground/server/api-binary.ts`) — the e2e sweep drives the
 * same shape through the real viewer.
 */

import {
  evaluateMetricsFilter,
  metricsSuggestionLabel,
  parseMetricsBody,
  suggestMetricsCompletions,
} from '@openheaders/ui/workbench/components/request-editor/response/response-metrics-filter';
import { describe, expect, it } from 'vitest';

const BODY = [
  '# HELP oh_http_requests HTTP requests handled by the playground.',
  '# TYPE oh_http_requests counter',
  'oh_http_requests_total{code="200",path="/api/echo"} 1027',
  'oh_http_requests_total{code="500",path="/api/echo"} 3',
  '# HELP oh_build_info Build metadata.',
  '# TYPE oh_build_info gauge',
  'oh_build_info{version="2026.7.1",host="playground.openheaders.io"} 1',
  '# HELP oh_request_duration_seconds Request latency.',
  '# TYPE oh_request_duration_seconds histogram',
  'oh_request_duration_seconds_bucket{le="0.1"} 512 # {trace_id="4bf92f3577b34da6"} 0.054 1720000000.123',
  'oh_request_duration_seconds_bucket{le="1"} 1000',
  'oh_request_duration_seconds_bucket{le="+Inf"} 1027',
  'oh_request_duration_seconds_sum 84.5',
  'oh_request_duration_seconds_count 1027',
  '# HELP oh_sync_lag_seconds Sync lag quantiles.',
  '# TYPE oh_sync_lag_seconds summary',
  'oh_sync_lag_seconds{quantile="0.5"} 0.012',
  'oh_sync_lag_seconds{quantile="0.99"} 0.087',
  'oh_sync_lag_seconds_sum 9.2',
  'oh_sync_lag_seconds_count 512',
  '# EOF',
  '',
].join('\n');

const doc = parseMetricsBody(BODY);

describe('parseMetricsBody', () => {
  it('groups metadata and samples into families, siblings included', () => {
    expect(doc.families.map((f) => f.name)).toEqual([
      'oh_http_requests',
      'oh_build_info',
      'oh_request_duration_seconds',
      'oh_sync_lag_seconds',
    ]);
    const histogram = doc.families[2];
    expect(histogram.headerLines).toHaveLength(2);
    // _bucket / _sum / _count all attach to the declared family.
    expect(histogram.series.map((s) => s.name)).toEqual([
      'oh_request_duration_seconds_bucket',
      'oh_request_duration_seconds_bucket',
      'oh_request_duration_seconds_bucket',
      'oh_request_duration_seconds_sum',
      'oh_request_duration_seconds_count',
    ]);
  });

  it('attaches _total samples to their declared counter family', () => {
    expect(doc.families[0].series).toHaveLength(2);
    expect(doc.families[0].series[0].labels).toEqual({ code: '200', path: '/api/echo' });
  });

  it('keeps sample lines verbatim, exemplar and all', () => {
    expect(doc.families[2].series[0].line).toBe(
      'oh_request_duration_seconds_bucket{le="0.1"} 512 # {trace_id="4bf92f3577b34da6"} 0.054 1720000000.123',
    );
  });

  it('mints implicit families for undeclared samples', () => {
    const implicit = parseMetricsBody('oh_up{host="api.openheaders.io"} 1');
    expect(implicit.families).toHaveLength(1);
    expect(implicit.families[0].name).toBe('oh_up');
    expect(implicit.families[0].headerLines).toEqual([]);
  });

  it('unescapes label values and skips malformed lines', () => {
    const parsed = parseMetricsBody(
      ['oh_msg{text="a \\"quoted\\" \\\\ line\\n"} 1', 'not a metric line !!!', 'oh_ok 2'].join('\n'),
    );
    expect(parsed.families[0].series[0].labels.text).toBe('a "quoted" \\ line\n');
    expect(parsed.families.map((f) => f.name)).toEqual(['oh_msg', 'oh_ok']);
  });
});

describe('evaluateMetricsFilter — bare substring', () => {
  it('matches families case-insensitively and returns whole family blocks', () => {
    const result = evaluateMetricsFilter(doc, 'HTTP');
    expect(result.ok && result.matches).toEqual([
      [
        '# HELP oh_http_requests HTTP requests handled by the playground.',
        '# TYPE oh_http_requests counter',
        'oh_http_requests_total{code="200",path="/api/echo"} 1027',
        'oh_http_requests_total{code="500",path="/api/echo"} 3',
      ].join('\n'),
    ]);
  });

  it('matches sample names too, still family-level', () => {
    const result = evaluateMetricsFilter(doc, 'bucket');
    expect(result.ok && result.matches).toHaveLength(1);
    expect(result.ok && result.matches[0]).toContain('oh_request_duration_seconds_sum 84.5');
  });

  it('returns ok with no matches when nothing fits', () => {
    expect(evaluateMetricsFilter(doc, 'nope_nothing')).toEqual({ ok: true, matches: [] });
  });
});

describe('evaluateMetricsFilter — selector', () => {
  it('narrows to matching series, header lines riding along', () => {
    const result = evaluateMetricsFilter(doc, 'oh_http_requests{code="500"}');
    expect(result.ok && result.matches).toEqual([
      [
        '# HELP oh_http_requests HTTP requests handled by the playground.',
        '# TYPE oh_http_requests counter',
        'oh_http_requests_total{code="500",path="/api/echo"} 3',
      ].join('\n'),
    ]);
  });

  it('accepts the exact sample name of a sibling (`_bucket` narrows to buckets)', () => {
    const result = evaluateMetricsFilter(doc, 'oh_request_duration_seconds_bucket{le="+Inf"}');
    expect(result.ok && result.matches).toEqual([
      [
        '# HELP oh_request_duration_seconds Request latency.',
        '# TYPE oh_request_duration_seconds histogram',
        'oh_request_duration_seconds_bucket{le="+Inf"} 1027',
      ].join('\n'),
    ]);
  });

  it('supports !=, =~ and !~ with full-anchored regexes', () => {
    const ne = evaluateMetricsFilter(doc, 'oh_http_requests{code!="500"}');
    expect(ne.ok && ne.matches[0]).toContain('code="200"');
    expect(ne.ok && ne.matches[0]).not.toContain('code="500"');

    const re = evaluateMetricsFilter(doc, '{quantile=~"0\\.[59]+"}');
    expect(re.ok && re.matches).toHaveLength(1);
    expect(re.ok && re.matches[0]).toContain('oh_sync_lag_seconds{quantile="0.5"} 0.012');
    // Full anchoring: "0.5" must not regex-match a bare "0".
    const anchored = evaluateMetricsFilter(doc, '{quantile=~"0"}');
    expect(anchored.ok && anchored.matches).toEqual([]);

    const nre = evaluateMetricsFilter(doc, 'oh_http_requests{code!~"2.."}');
    expect(nre.ok && nre.matches[0]).toContain('code="500"');
  });

  it('treats an absent label as the empty string (PromQL semantics)', () => {
    // `_sum`/`_count` carry no `le` label — they match le="" and le!="0.1".
    const empty = evaluateMetricsFilter(doc, 'oh_request_duration_seconds{le=""}');
    expect(empty.ok && empty.matches[0]).toContain('oh_request_duration_seconds_sum 84.5');
    expect(empty.ok && empty.matches[0]).not.toContain('_bucket');
  });

  it('a nameless matcher set sweeps every family', () => {
    const result = evaluateMetricsFilter(doc, '{code="500"}');
    expect(result.ok && result.matches).toHaveLength(1);
    expect(result.ok && result.matches[0]).toContain('oh_http_requests_total{code="500"');
  });

  it('an empty selector shows the named family whole', () => {
    const result = evaluateMetricsFilter(doc, 'oh_build_info{}');
    expect(result.ok && result.matches).toEqual([
      [
        '# HELP oh_build_info Build metadata.',
        '# TYPE oh_build_info gauge',
        'oh_build_info{version="2026.7.1",host="playground.openheaders.io"} 1',
      ].join('\n'),
    ]);
  });
});

describe('evaluateMetricsFilter — mid-edit forgiveness vs closed errors', () => {
  it('evaluates the completed part while the brace is open', () => {
    for (const partial of [
      'oh_http_requests{',
      'oh_http_requests{code',
      'oh_http_requests{code=',
      'oh_http_requests{code="5',
    ]) {
      const result = evaluateMetricsFilter(doc, partial);
      expect(result.ok, partial).toBe(true);
      expect(result.ok && result.matches).toHaveLength(1);
    }
    // A completed matcher followed by a dangling one keeps the matcher.
    const dangling = evaluateMetricsFilter(doc, 'oh_http_requests{code="500",path=');
    expect(dangling.ok && dangling.matches[0]).not.toContain('code="200"');
  });

  it('rejects malformed CLOSED selectors and trailing garbage', () => {
    expect(evaluateMetricsFilter(doc, 'oh_http_requests{code}')).toEqual({ ok: false });
    expect(evaluateMetricsFilter(doc, 'oh_http_requests{code="500"} extra')).toEqual({ ok: false });
    expect(evaluateMetricsFilter(doc, 'not a name{code="500"}')).toEqual({ ok: false });
    expect(evaluateMetricsFilter(doc, '{code=~"("}')).toEqual({ ok: false });
  });
});

describe('evaluateMetricsFilter — wire fidelity', () => {
  it('every output line is a verbatim line of the source body', () => {
    const source = new Set(BODY.split('\n'));
    const result = evaluateMetricsFilter(doc, 'oh');
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const block of result.matches) {
        for (const line of block.split('\n')) expect(source.has(line), line).toBe(true);
      }
    }
  });
});

describe('suggestMetricsCompletions', () => {
  it('offers family names, trailing { when the family carries labels', () => {
    expect(suggestMetricsCompletions(doc, 'http')).toEqual(['oh_http_requests{']);
    const bare = parseMetricsBody('oh_up 1');
    expect(suggestMetricsCompletions(bare, 'up')).toEqual(['oh_up']);
  });

  it('offers label keys after { and , — full replacement strings ending in =', () => {
    expect(suggestMetricsCompletions(doc, 'oh_http_requests{')).toEqual([
      'oh_http_requests{code=',
      'oh_http_requests{path=',
    ]);
    expect(suggestMetricsCompletions(doc, 'oh_http_requests{code="500",p')).toEqual([
      'oh_http_requests{code="500",path=',
    ]);
  });

  it('offers quoted label values after an operator, filtered by the typed fragment', () => {
    expect(suggestMetricsCompletions(doc, 'oh_http_requests{code=')).toEqual([
      'oh_http_requests{code="200"',
      'oh_http_requests{code="500"',
    ]);
    expect(suggestMetricsCompletions(doc, 'oh_http_requests{code="5')).toEqual(['oh_http_requests{code="500"']);
    expect(suggestMetricsCompletions(doc, '{host=~"')).toEqual(['{host=~"playground.openheaders.io"']);
  });

  it('goes quiet on a closed selector or an unknown name', () => {
    expect(suggestMetricsCompletions(doc, 'oh_http_requests{code="500"}')).toEqual([]);
    expect(suggestMetricsCompletions(doc, 'oh_missing{')).toEqual([]);
  });
});

describe('metricsSuggestionLabel', () => {
  it('shows the segment the suggestion appends', () => {
    expect(metricsSuggestionLabel('oh_http_requests{')).toBe('oh_http_requests');
    expect(metricsSuggestionLabel('oh_http_requests{code=')).toBe('code=');
    expect(metricsSuggestionLabel('oh_http_requests{code="500",path=')).toBe('path=');
    expect(metricsSuggestionLabel('oh_http_requests{code="500"')).toBe('code="500"');
  });
});
