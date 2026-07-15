/**
 * HTTP-header docs — Content.
 * Pulled in by `./index` and merged into the master HEADER_INFO map.
 */

import type { HeaderInfoEntries } from './types';

export const CONTENT_HEADERS: HeaderInfoEntries = [
  [
    'content-type',
    {
      display: 'Content-Type',
      direction: 'both',
      category: 'Content',
      summaryKey: 'shared.info.header.contentType.summary',
      bodyKeys: ['shared.info.header.contentType.body1', 'shared.info.header.contentType.body2'],
      commonValues: [
        { value: 'application/json', descKey: 'shared.info.header.contentType.value.applicationJson' },
        {
          value: 'application/x-www-form-urlencoded',
          descKey: 'shared.info.header.contentType.value.applicationXWwwFormUrlencoded',
        },
        { value: 'multipart/form-data', descKey: 'shared.info.header.contentType.value.multipartFormData' },
        { value: 'text/html; charset=utf-8', descKey: 'shared.info.header.contentType.value.textHtmlCharsetUtf8' },
        { value: 'application/octet-stream', descKey: 'shared.info.header.contentType.value.applicationOctetStream' },
      ],
    },
  ],
  [
    'content-length',
    {
      display: 'Content-Length',
      direction: 'both',
      category: 'Content',
      summaryKey: 'shared.info.header.contentLength.summary',
      bodyKeys: ['shared.info.header.contentLength.body1'],
    },
  ],
  [
    'content-encoding',
    {
      display: 'Content-Encoding',
      direction: 'response',
      category: 'Content',
      summaryKey: 'shared.info.header.contentEncoding.summary',
      bodyKeys: ['shared.info.header.contentEncoding.body1'],
    },
  ],
  [
    'content-disposition',
    {
      display: 'Content-Disposition',
      direction: 'response',
      category: 'Content',
      summaryKey: 'shared.info.header.contentDisposition.summary',
      bodyKeys: ['shared.info.header.contentDisposition.body1'],
    },
  ],
  [
    'accept',
    {
      display: 'Accept',
      direction: 'request',
      category: 'Content',
      summaryKey: 'shared.info.header.accept.summary',
      bodyKeys: ['shared.info.header.accept.body1'],
    },
  ],
  [
    'accept-encoding',
    {
      display: 'Accept-Encoding',
      direction: 'request',
      category: 'Content',
      summaryKey: 'shared.info.header.acceptEncoding.summary',
      bodyKeys: ['shared.info.header.acceptEncoding.body1'],
    },
  ],
  [
    'accept-language',
    {
      display: 'Accept-Language',
      direction: 'request',
      category: 'Content',
      summaryKey: 'shared.info.header.acceptLanguage.summary',
      bodyKeys: ['shared.info.header.acceptLanguage.body1'],
    },
  ],
  [
    'transfer-encoding',
    {
      display: 'Transfer-Encoding',
      direction: 'both',
      category: 'Content',
      summaryKey: 'shared.info.header.transferEncoding.summary',
      bodyKeys: ['shared.info.header.transferEncoding.body1'],
    },
  ],
  [
    'range',
    {
      display: 'Range',
      direction: 'request',
      category: 'Content',
      summaryKey: 'shared.info.header.range.summary',
      bodyKeys: ['shared.info.header.range.body1'],
    },
  ],
  [
    'content-range',
    {
      display: 'Content-Range',
      direction: 'response',
      category: 'Content',
      summaryKey: 'shared.info.header.contentRange.summary',
      bodyKeys: ['shared.info.header.contentRange.body1'],
    },
  ],
  [
    'accept-ranges',
    {
      display: 'Accept-Ranges',
      direction: 'response',
      category: 'Content',
      summaryKey: 'shared.info.header.acceptRanges.summary',
    },
  ],
  [
    'content-md5',
    {
      display: 'Content-MD5',
      direction: 'both',
      category: 'Content',
      summaryKey: 'shared.info.header.contentMd5.summary',
      bodyKeys: ['shared.info.header.contentMd5.body1'],
    },
  ],
  [
    'content-language',
    {
      display: 'Content-Language',
      direction: 'response',
      category: 'Content',
      summaryKey: 'shared.info.header.contentLanguage.summary',
      bodyKeys: ['shared.info.header.contentLanguage.body1'],
    },
  ],
  [
    'content-location',
    {
      display: 'Content-Location',
      direction: 'response',
      category: 'Content',
      summaryKey: 'shared.info.header.contentLocation.summary',
      bodyKeys: ['shared.info.header.contentLocation.body1'],
    },
  ],
  [
    'accept-charset',
    {
      display: 'Accept-Charset',
      direction: 'request',
      category: 'Content',
      summaryKey: 'shared.info.header.acceptCharset.summary',
      bodyKeys: ['shared.info.header.acceptCharset.body1'],
    },
  ],
  [
    'if-range',
    {
      display: 'If-Range',
      direction: 'request',
      category: 'Content',
      summaryKey: 'shared.info.header.ifRange.summary',
      bodyKeys: ['shared.info.header.ifRange.body1'],
    },
  ],
  [
    'trailer',
    {
      display: 'Trailer',
      direction: 'response',
      category: 'Content',
      summaryKey: 'shared.info.header.trailer.summary',
      bodyKeys: ['shared.info.header.trailer.body1'],
    },
  ],
];
