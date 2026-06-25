/**
 * Per-section `{{ref}}` resolvability for the request editor.
 *
 * One resolver walk per tab so the inline tab dots can flag exactly
 * which section needs attention. Each flag is `true` when at least one
 * `{{ref}}` in that tab's strings fails to resolve — excluding
 * reserved-namespace refs (`{{file.X}}` / `{{dynamic.X}}`), which are
 * intentionally unresolved until those features ship. `hasUnresolvedRefs`
 * is the OR aggregate that gates the Send button + tab-bar greying
 * (equivalent to walking every string via `isRequestResolvable`, but the
 * per-section walk already pays that cost).
 */

import { resolveTemplate } from '@openheaders/core/variables';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import { useMemo } from 'react';
import type { Draft } from './draft';

export interface SectionUnresolved {
  url: boolean;
  params: boolean;
  headers: boolean;
  auth: boolean;
  body: boolean;
}

export function useSectionUnresolved(
  draft: Draft,
  draftCollectionId: string | undefined,
): { sectionUnresolved: SectionUnresolved; hasUnresolvedRefs: boolean } {
  const requestResolver = useVariableResolver();

  const sectionUnresolved = useMemo<SectionUnresolved>(() => {
    const context = draftCollectionId ? { collectionId: draftCollectionId } : undefined;
    const flat = (name: string) => requestResolver.resolve(name, context);
    const scoped = (name: string, ns: Parameters<typeof requestResolver.resolveScopedWithDiagnostics>[1]) =>
      requestResolver.resolveScopedWithDiagnostics(name, ns, context);
    const anyUnresolved = (strings: readonly string[]): boolean => {
      for (const s of strings) {
        if (!s) continue;
        const { errors } = resolveTemplate(s, flat, scoped);
        if (errors.some((e) => e.reason !== 'reserved-namespace')) return true;
      }
      return false;
    };
    const urlStrings = [draft.url];
    const paramStrings: string[] = [];
    for (const r of draft.params) {
      if (r.enabled === false) continue;
      if (r.key) paramStrings.push(r.key);
      if (r.value) paramStrings.push(r.value);
    }
    const headerStrings: string[] = [];
    for (const r of draft.headers) {
      if (r.enabled === false) continue;
      if (r.key) headerStrings.push(r.key);
      if (r.value) headerStrings.push(r.value);
    }
    const authStrings: string[] = [];
    const auth = draft.auth;
    switch (auth.type) {
      case 'basic':
        if (auth.username) authStrings.push(auth.username);
        if (auth.password) authStrings.push(auth.password);
        break;
      case 'bearer':
        if (auth.token) authStrings.push(auth.token);
        break;
      case 'api-key':
        if (auth.key) authStrings.push(auth.key);
        if (auth.value) authStrings.push(auth.value);
        break;
    }
    // Body walk — exhaustive over the discriminated union so an
    // unresolved `{{ref}}` in a form / graphql variant is reflected
    // in the section badge, not silently dropped. Mirrors the
    // collector in `core/live/request-scan.ts`.
    const bodyStrings: string[] = [];
    const body = draft.body;
    switch (body.type) {
      case 'none':
        break;
      case 'json':
      case 'xml':
      case 'text':
        if (body.content) bodyStrings.push(body.content);
        break;
      case 'graphql':
        if (body.content) bodyStrings.push(body.content);
        if (body.graphqlVariables) bodyStrings.push(body.graphqlVariables);
        break;
      case 'form':
        for (const part of body.formParts) {
          if (part.enabled === false) continue;
          if (part.key) bodyStrings.push(part.key);
          if (part.value) bodyStrings.push(part.value);
        }
        break;
      case 'multipart':
        for (const part of body.multipartParts) {
          if (part.enabled === false) continue;
          if (part.name) bodyStrings.push(part.name);
          if (part.kind === 'text' && part.value) bodyStrings.push(part.value);
        }
        break;
      default: {
        const _exhaustive: never = body;
        void _exhaustive;
      }
    }
    return {
      url: anyUnresolved(urlStrings),
      params: anyUnresolved(paramStrings),
      headers: anyUnresolved(headerStrings),
      auth: anyUnresolved(authStrings),
      body: anyUnresolved(bodyStrings),
    };
  }, [draft, draftCollectionId, requestResolver]);

  const hasUnresolvedRefs =
    sectionUnresolved.url ||
    sectionUnresolved.params ||
    sectionUnresolved.headers ||
    sectionUnresolved.auth ||
    sectionUnresolved.body;

  return { sectionUnresolved, hasUnresolvedRefs };
}
