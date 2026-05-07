/**
 * Per-field save merge for V5.Request editors. Same architectural
 * shape as `merge-rule-for-save.ts` (Session 24). Closes the
 * Save-stomp gap that the auto-merge effect leaves open against a
 * race window: if a peer commit broadcasts AFTER the auto-merge
 * applied but BEFORE the next render fires, the form could still
 * carry baseline values for paths the peer just changed; without this
 * merge those values would land in the save batch and stomp the
 * peer's edit.
 *
 * Header + param rows merge by uid; body discriminated-union folds
 * into a whole-or-nothing pick (form === baseline → adopt live, else
 * keep ours) because form/multipart parts don't carry uids and would
 * be index-keyed otherwise. Top-level scalars merge per-leaf.
 */

import type { V5 } from '@openheaders/core/types';
import { deepEqual, mergeRowsByIdentity, mergeScalarLeaves } from '@/shared/forms/per-field-merge';

export interface RequestSaveBatch {
  description: string | undefined;
  method: V5.HttpMethod;
  url: string;
  headers: V5.RequestHeader[];
  params: V5.QueryParam[];
  auth: V5.AuthConfig;
  body: V5.RequestBody;
  credentialsMode: V5.CredentialsMode | undefined;
  followRedirects: boolean | undefined;
  preRequestScript: string | undefined;
  postResponseScript: string | undefined;
}

function projectRequest(req: V5.Request): RequestSaveBatch {
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
    preRequestScript: req.preRequestScript,
    postResponseScript: req.postResponseScript,
  };
}

export function mergeRequestForSave(
  form: RequestSaveBatch,
  baseline: V5.Request | null,
  live: V5.Request | null,
): RequestSaveBatch {
  if (!baseline || !live) return form;
  const baseProj = projectRequest(baseline);
  const liveProj = projectRequest(live);

  const headers = mergeRowsByIdentity(
    form.headers as ReadonlyArray<V5.RequestHeader & Record<string, unknown>>,
    baseProj.headers as ReadonlyArray<V5.RequestHeader & Record<string, unknown>>,
    liveProj.headers as ReadonlyArray<V5.RequestHeader & Record<string, unknown>>,
    'uid',
  ) as V5.RequestHeader[];

  const params = mergeRowsByIdentity(
    form.params as ReadonlyArray<V5.QueryParam & Record<string, unknown>>,
    baseProj.params as ReadonlyArray<V5.QueryParam & Record<string, unknown>>,
    liveProj.params as ReadonlyArray<V5.QueryParam & Record<string, unknown>>,
    'uid',
  ) as V5.QueryParam[];

  // Scalar leaves (everything except headers/params/body — those are
  // structural and merged separately).
  const scalarForm: Record<string, unknown> = {
    description: form.description,
    method: form.method,
    url: form.url,
    auth: form.auth,
    credentialsMode: form.credentialsMode,
    followRedirects: form.followRedirects,
    preRequestScript: form.preRequestScript,
    postResponseScript: form.postResponseScript,
  };
  const scalarBase: Record<string, unknown> = {
    description: baseProj.description,
    method: baseProj.method,
    url: baseProj.url,
    auth: baseProj.auth,
    credentialsMode: baseProj.credentialsMode,
    followRedirects: baseProj.followRedirects,
    preRequestScript: baseProj.preRequestScript,
    postResponseScript: baseProj.postResponseScript,
  };
  const scalarLive: Record<string, unknown> = {
    description: liveProj.description,
    method: liveProj.method,
    url: liveProj.url,
    auth: liveProj.auth,
    credentialsMode: liveProj.credentialsMode,
    followRedirects: liveProj.followRedirects,
    preRequestScript: liveProj.preRequestScript,
    postResponseScript: liveProj.postResponseScript,
  };
  const merged = mergeScalarLeaves(scalarForm, scalarBase, scalarLive);

  // Body is a discriminated union with no row-level identity inside
  // form/multipart parts; treat it as a whole. Untouched (form ===
  // baseline) → adopt live; otherwise keep ours.
  const body = deepEqual(form.body, baseProj.body) ? liveProj.body : form.body;

  return {
    description: merged.description as string | undefined,
    method: merged.method as V5.HttpMethod,
    url: merged.url as string,
    headers,
    params,
    auth: merged.auth as V5.AuthConfig,
    body,
    credentialsMode: merged.credentialsMode as V5.CredentialsMode | undefined,
    followRedirects: merged.followRedirects as boolean | undefined,
    preRequestScript: merged.preRequestScript as string | undefined,
    postResponseScript: merged.postResponseScript as string | undefined,
  };
}
