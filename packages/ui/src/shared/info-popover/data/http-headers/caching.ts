/**
 * HTTP-header docs — Caching.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CACHING_HEADERS: HeaderInfoEntries = [
  [
    'cache-control',
    {
      display: 'Cache-Control',
      direction: 'both',
      category: 'Caching',
      summaryKey: 'shared.info.header.cacheControl.summary',
      bodyKeys: ['shared.info.header.cacheControl.body1'],
      directives: [
        { key: 'no-store', descKey: 'shared.info.header.cacheControl.directive.noStore' },
        { key: 'no-cache', descKey: 'shared.info.header.cacheControl.directive.noCache' },
        { key: 'public', descKey: 'shared.info.header.cacheControl.directive.public' },
        { key: 'private', descKey: 'shared.info.header.cacheControl.directive.private' },
        { key: 'max-age=N', descKey: 'shared.info.header.cacheControl.directive.maxAgeN' },
        { key: 's-maxage=N', descKey: 'shared.info.header.cacheControl.directive.sMaxageN' },
        { key: 'must-revalidate', descKey: 'shared.info.header.cacheControl.directive.mustRevalidate' },
        { key: 'immutable', descKey: 'shared.info.header.cacheControl.directive.immutable' },
        { key: 'stale-while-revalidate=N', descKey: 'shared.info.header.cacheControl.directive.staleWhileRevalidateN' },
      ],
    },
  ],
  [
    'pragma',
    {
      display: 'Pragma',
      direction: 'both',
      category: 'Caching',
      summaryKey: 'shared.info.header.pragma.summary',
      bodyKeys: ['shared.info.header.pragma.body1'],
    },
  ],
  [
    'expires',
    {
      display: 'Expires',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.expires.summary',
      bodyKeys: ['shared.info.header.expires.body1'],
    },
  ],
  [
    'etag',
    {
      display: 'ETag',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.etag.summary',
      bodyKeys: ['shared.info.header.etag.body1'],
    },
  ],
  [
    'if-match',
    {
      display: 'If-Match',
      direction: 'request',
      category: 'Caching',
      summaryKey: 'shared.info.header.ifMatch.summary',
      bodyKeys: ['shared.info.header.ifMatch.body1'],
    },
  ],
  [
    'if-none-match',
    {
      display: 'If-None-Match',
      direction: 'request',
      category: 'Caching',
      summaryKey: 'shared.info.header.ifNoneMatch.summary',
      bodyKeys: ['shared.info.header.ifNoneMatch.body1'],
    },
  ],
  [
    'if-modified-since',
    {
      display: 'If-Modified-Since',
      direction: 'request',
      category: 'Caching',
      summaryKey: 'shared.info.header.ifModifiedSince.summary',
      bodyKeys: ['shared.info.header.ifModifiedSince.body1'],
    },
  ],
  [
    'if-unmodified-since',
    {
      display: 'If-Unmodified-Since',
      direction: 'request',
      category: 'Caching',
      summaryKey: 'shared.info.header.ifUnmodifiedSince.summary',
    },
  ],
  [
    'last-modified',
    {
      display: 'Last-Modified',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.lastModified.summary',
      bodyKeys: ['shared.info.header.lastModified.body1'],
    },
  ],
  [
    'age',
    {
      display: 'Age',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.age.summary',
      bodyKeys: ['shared.info.header.age.body1'],
    },
  ],
  [
    'x-cache',
    {
      display: 'X-Cache',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.xCache.summary',
      commonValues: [
        { value: 'HIT', descKey: 'shared.info.header.xCache.value.hit' },
        { value: 'MISS', descKey: 'shared.info.header.xCache.value.miss' },
        { value: 'HIT, HIT', descKey: 'shared.info.header.xCache.value.hitHit' },
      ],
    },
  ],
  [
    'x-cache-hits',
    {
      display: 'X-Cache-Hits',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.xCacheHits.summary',
      bodyKeys: ['shared.info.header.xCacheHits.body1'],
    },
  ],
  [
    'warning',
    {
      display: 'Warning',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.warning.summary',
    },
  ],
  [
    'surrogate-control',
    {
      display: 'Surrogate-Control',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.surrogateControl.summary',
      bodyKeys: ['shared.info.header.surrogateControl.body1'],
    },
  ],
  [
    'surrogate-capability',
    {
      display: 'Surrogate-Capability',
      direction: 'request',
      category: 'Caching',
      summaryKey: 'shared.info.header.surrogateCapability.summary',
    },
  ],
  [
    'cf-cache-status',
    {
      display: 'CF-Cache-Status',
      direction: 'response',
      category: 'Caching',
      summaryKey: 'shared.info.header.cfCacheStatus.summary',
      commonValues: [
        { value: 'HIT', descKey: 'shared.info.header.cfCacheStatus.value.hit' },
        { value: 'MISS', descKey: 'shared.info.header.cfCacheStatus.value.miss' },
        { value: 'EXPIRED', descKey: 'shared.info.header.cfCacheStatus.value.expired' },
        { value: 'BYPASS', descKey: 'shared.info.header.cfCacheStatus.value.bypass' },
        { value: 'DYNAMIC', descKey: 'shared.info.header.cfCacheStatus.value.dynamic' },
        { value: 'REVALIDATED', descKey: 'shared.info.header.cfCacheStatus.value.revalidated' },
      ],
    },
  ],
];
