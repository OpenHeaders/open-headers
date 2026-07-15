/**
 * HTTP-header docs — Security.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const SECURITY_HEADERS: HeaderInfoEntries = [
  [
    'content-security-policy',
    {
      display: 'Content-Security-Policy',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.contentSecurityPolicy.summary',
      bodyKeys: ['shared.info.header.contentSecurityPolicy.body1', 'shared.info.header.contentSecurityPolicy.body2'],
      directives: [
        { key: 'default-src', descKey: 'shared.info.header.contentSecurityPolicy.directive.defaultSrc' },
        { key: 'script-src', descKey: 'shared.info.header.contentSecurityPolicy.directive.scriptSrc' },
        { key: 'style-src', descKey: 'shared.info.header.contentSecurityPolicy.directive.styleSrc' },
        { key: 'img-src', descKey: 'shared.info.header.contentSecurityPolicy.directive.imgSrc' },
        { key: 'connect-src', descKey: 'shared.info.header.contentSecurityPolicy.directive.connectSrc' },
        { key: 'frame-ancestors', descKey: 'shared.info.header.contentSecurityPolicy.directive.frameAncestors' },
        {
          key: 'report-uri / report-to',
          descKey: 'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo',
        },
      ],
    },
  ],
  [
    'content-security-policy-report-only',
    {
      display: 'Content-Security-Policy-Report-Only',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.contentSecurityPolicyReportOnly.summary',
      bodyKeys: ['shared.info.header.contentSecurityPolicyReportOnly.body1'],
    },
  ],
  [
    'strict-transport-security',
    {
      display: 'Strict-Transport-Security',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.strictTransportSecurity.summary',
      bodyKeys: [
        'shared.info.header.strictTransportSecurity.body1',
        'shared.info.header.strictTransportSecurity.body2',
      ],
      directives: [
        { key: 'max-age=N', descKey: 'shared.info.header.strictTransportSecurity.directive.maxAgeN' },
        { key: 'includeSubDomains', descKey: 'shared.info.header.strictTransportSecurity.directive.includeSubDomains' },
        { key: 'preload', descKey: 'shared.info.header.strictTransportSecurity.directive.preload' },
      ],
    },
  ],
  [
    'x-content-type-options',
    {
      display: 'X-Content-Type-Options',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.xContentTypeOptions.summary',
      bodyKeys: ['shared.info.header.xContentTypeOptions.body1'],
    },
  ],
  [
    'x-frame-options',
    {
      display: 'X-Frame-Options',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.xFrameOptions.summary',
      bodyKeys: ['shared.info.header.xFrameOptions.body1'],
      commonValues: [
        { value: 'DENY', descKey: 'shared.info.header.xFrameOptions.value.deny' },
        { value: 'SAMEORIGIN', descKey: 'shared.info.header.xFrameOptions.value.sameorigin' },
      ],
    },
  ],
  [
    'x-xss-protection',
    {
      display: 'X-XSS-Protection',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.xXssProtection.summary',
      bodyKeys: ['shared.info.header.xXssProtection.body1'],
    },
  ],
  [
    'referrer-policy',
    {
      display: 'Referrer-Policy',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.referrerPolicy.summary',
      bodyKeys: ['shared.info.header.referrerPolicy.body1'],
      commonValues: [
        { value: 'no-referrer', descKey: 'shared.info.header.referrerPolicy.value.noReferrer' },
        { value: 'origin', descKey: 'shared.info.header.referrerPolicy.value.origin' },
        {
          value: 'strict-origin-when-cross-origin',
          descKey: 'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin',
        },
        { value: 'unsafe-url', descKey: 'shared.info.header.referrerPolicy.value.unsafeUrl' },
      ],
    },
  ],
  [
    'permissions-policy',
    {
      display: 'Permissions-Policy',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.permissionsPolicy.summary',
      bodyKeys: ['shared.info.header.permissionsPolicy.body1'],
    },
  ],
  [
    'cross-origin-opener-policy',
    {
      display: 'Cross-Origin-Opener-Policy',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.crossOriginOpenerPolicy.summary',
      bodyKeys: ['shared.info.header.crossOriginOpenerPolicy.body1'],
    },
  ],
  [
    'cross-origin-embedder-policy',
    {
      display: 'Cross-Origin-Embedder-Policy',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.crossOriginEmbedderPolicy.summary',
      bodyKeys: ['shared.info.header.crossOriginEmbedderPolicy.body1'],
    },
  ],
  [
    'cross-origin-resource-policy',
    {
      display: 'Cross-Origin-Resource-Policy',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.crossOriginResourcePolicy.summary',
      bodyKeys: ['shared.info.header.crossOriginResourcePolicy.body1'],
    },
  ],
  [
    'clear-site-data',
    {
      display: 'Clear-Site-Data',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.clearSiteData.summary',
      bodyKeys: ['shared.info.header.clearSiteData.body1'],
      commonValues: [
        { value: '"cookies"', descKey: 'shared.info.header.clearSiteData.value.cookies' },
        { value: '"cache"', descKey: 'shared.info.header.clearSiteData.value.cache' },
        { value: '"storage"', descKey: 'shared.info.header.clearSiteData.value.storage' },
        { value: '"*"', descKey: 'shared.info.header.clearSiteData.value.wildcard' },
      ],
    },
  ],
  [
    'origin-agent-cluster',
    {
      display: 'Origin-Agent-Cluster',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.originAgentCluster.summary',
      bodyKeys: ['shared.info.header.originAgentCluster.body1'],
    },
  ],
  [
    'x-robots-tag',
    {
      display: 'X-Robots-Tag',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.xRobotsTag.summary',
      bodyKeys: ['shared.info.header.xRobotsTag.body1'],
    },
  ],
  [
    'x-ua-compatible',
    {
      display: 'X-UA-Compatible',
      direction: 'response',
      category: 'Security',
      summaryKey: 'shared.info.header.xUaCompatible.summary',
    },
  ],
];
