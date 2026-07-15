/**
 * HTTP-header docs — Tracing.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const TRACING_HEADERS: HeaderInfoEntries = [
  [
    'server-timing',
    {
      display: 'Server-Timing',
      direction: 'response',
      category: 'Tracing',
      summaryKey: 'shared.info.header.serverTiming.summary',
      bodyKeys: ['shared.info.header.serverTiming.body1'],
    },
  ],
  [
    'traceparent',
    {
      display: 'traceparent',
      direction: 'both',
      category: 'Tracing',
      summaryKey: 'shared.info.header.traceparent.summary',
      bodyKeys: ['shared.info.header.traceparent.body1'],
    },
  ],
  [
    'tracestate',
    {
      display: 'tracestate',
      direction: 'both',
      category: 'Tracing',
      summaryKey: 'shared.info.header.tracestate.summary',
      bodyKeys: ['shared.info.header.tracestate.body1'],
    },
  ],
  [
    'x-request-id',
    {
      display: 'X-Request-Id',
      direction: 'both',
      category: 'Tracing',
      summaryKey: 'shared.info.header.xRequestId.summary',
      bodyKeys: ['shared.info.header.xRequestId.body1'],
    },
  ],
  [
    'x-fastly-request-id',
    {
      display: 'X-Fastly-Request-Id',
      direction: 'response',
      category: 'Tracing',
      summaryKey: 'shared.info.header.xFastlyRequestId.summary',
    },
  ],
  [
    'reporting-endpoints',
    {
      display: 'Reporting-Endpoints',
      direction: 'response',
      category: 'Tracing',
      summaryKey: 'shared.info.header.reportingEndpoints.summary',
      bodyKeys: ['shared.info.header.reportingEndpoints.body1'],
    },
  ],
  [
    'report-to',
    {
      display: 'Report-To',
      direction: 'response',
      category: 'Tracing',
      summaryKey: 'shared.info.header.reportTo.summary',
    },
  ],
  [
    'nel',
    {
      display: 'NEL',
      direction: 'response',
      category: 'Tracing',
      summaryKey: 'shared.info.header.nel.summary',
      bodyKeys: ['shared.info.header.nel.body1'],
    },
  ],
  [
    'cf-ray',
    {
      display: 'CF-Ray',
      direction: 'response',
      category: 'Tracing',
      summaryKey: 'shared.info.header.cfRay.summary',
      bodyKeys: ['shared.info.header.cfRay.body1'],
    },
  ],
];
