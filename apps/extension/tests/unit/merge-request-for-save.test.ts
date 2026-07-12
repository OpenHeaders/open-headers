import type { QueryParam, Request, RequestHeader } from '@openheaders/core/types';
import {
  mergeRequestForSave,
  type RequestSaveBatch,
} from '@openheaders/ui/workbench/components/request-editor/merge-request-for-save';
import { describe, expect, it } from 'vitest';

const hdr = (uid: string, key: string, value: string): RequestHeader => ({ uid, key, value });
const param = (uid: string, key: string, value: string): QueryParam => ({ uid, key, value });

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'req-aaaa',
    path: 'requests/req-aaaa',
    name: 'Get Token',
    method: 'GET',
    url: 'https://api.openheaders.io/token',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

function batchOf(req: Request): RequestSaveBatch {
  return {
    description: req.description,
    method: req.method,
    url: req.url,
    headers: req.headers,
    params: req.params,
    auth: req.auth,
    body: req.body,
    credentialsMode: req.credentialsMode,
    followRedirects: req.followRedirects,
    sslVerification: req.sslVerification,
    preRequestScript: req.preRequestScript,
    postResponseScript: req.postResponseScript,
  };
}

describe('mergeRequestForSave', () => {
  it('passes form through when baseline/live missing', () => {
    const form = batchOf(makeReq({ url: 'https://x' }));
    expect(mergeRequestForSave(form, null, null)).toEqual(form);
  });

  it('adopts live values for untouched scalars', () => {
    const baseline = makeReq({ url: 'https://a' });
    const live = makeReq({ url: 'https://b' });
    const form = batchOf(baseline); // user touched nothing
    const merged = mergeRequestForSave(form, baseline, live);
    expect(merged.url).toBe('https://b');
  });

  it('keeps form values for touched scalars', () => {
    const baseline = makeReq({ method: 'GET' });
    const live = makeReq({ method: 'PUT' });
    const form = batchOf(makeReq({ method: 'POST' }));
    const merged = mergeRequestForSave(form, baseline, live);
    expect(merged.method).toBe('POST');
  });

  it('per-row merges headers by uid', () => {
    const baseline = makeReq({
      headers: [hdr('a', 'X-A', 'b1'), hdr('b', 'X-B', 'b2')],
    });
    const live = makeReq({
      headers: [hdr('a', 'X-A', 'live1'), hdr('b', 'X-B', 'b2')],
    });
    const form = batchOf(makeReq({ headers: [hdr('a', 'X-A', 'b1'), hdr('b', 'X-B', 'mine2')] }));
    const merged = mergeRequestForSave(form, baseline, live);
    expect(merged.headers).toEqual([hdr('a', 'X-A', 'live1'), hdr('b', 'X-B', 'mine2')]);
  });

  it('per-row merges params by uid', () => {
    const baseline = makeReq({ params: [param('a', 'k', 'b')] });
    const live = makeReq({ params: [param('a', 'k', 'L')] });
    const form = batchOf(makeReq({ params: [param('a', 'k', 'b')] })); // untouched
    const merged = mergeRequestForSave(form, baseline, live);
    expect(merged.params).toEqual([param('a', 'k', 'L')]);
  });

  it('keeps body when user changed it; otherwise adopts live', () => {
    const baseline = makeReq({ body: { type: 'json', content: '{"a":1}' } });
    const liveChanged = makeReq({ body: { type: 'json', content: '{"a":2}' } });
    const formUnchanged = batchOf(baseline);
    const mergedAdoptsLive = mergeRequestForSave(formUnchanged, baseline, liveChanged);
    expect(mergedAdoptsLive.body).toEqual({ type: 'json', content: '{"a":2}' });

    const formChanged = batchOf(makeReq({ body: { type: 'json', content: '{"a":99}' } }));
    const mergedKeepsMine = mergeRequestForSave(formChanged, baseline, liveChanged);
    expect(mergedKeepsMine.body).toEqual({ type: 'json', content: '{"a":99}' });
  });

  it('preserves peer-added headers', () => {
    const baseline = makeReq({ headers: [hdr('a', 'X-A', '1')] });
    const live = makeReq({ headers: [hdr('a', 'X-A', '1'), hdr('b', 'X-B', 'peer')] });
    const form = batchOf(baseline);
    const merged = mergeRequestForSave(form, baseline, live);
    const uids = merged.headers.map((h) => h.uid).sort();
    expect(uids).toEqual(['a', 'b']);
  });
});
