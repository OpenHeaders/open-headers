/**
 * Shared collection-landing loop for parsed import sources.
 *
 * One code path lands a parsed collection section regardless of who
 * asks: the sectioned import modal (Postman backup / Insomnia / Bruno
 * / OpenAPI) and the spec editor's Generate Collection action both
 * drive this loop — generation reuses the import machinery, never a
 * parallel conversion pipeline (the API-specs plan §4).
 *
 * Per section: create the collection, land its scripts / default auth
 * / variables, create folders depth-first so parents exist, then the
 * requests. Write-path failures record report drops with full reasons
 * (nothing lossless presents as loss); a failed collection create
 * skips its whole section.
 */

import { fromHttpRequest, type GraphqlRequestContent } from '@openheaders/core/graphql';
import { type CurlRequest, type ImportReport, recordDrop, recordTransform } from '@openheaders/core/import';
import type { AuthConfig, Request, Variable } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';

/** Source-neutral parsed collection section (parser output shape). */
export interface SectionedCollection {
  name: string;
  /** Collection-level ancestor script slots (Postman backups carry
   *  them; Insomnia/Bruno parsers keep their own drop notes). */
  preRequestScript?: string;
  postResponseScript?: string;
  /** Collection-level default auth (Postman backups and OpenAPI
   *  documents carry it). */
  auth?: AuthConfig;
  /** Collection variables (OpenAPI: `{{baseUrl}}` + valued path
   *  parameters — load-bearing, every imported URL references them). */
  variables?: Array<{ name: string; value: string; type: 'default' | 'secret' }>;
  folders: Array<{ path: string[]; preRequestScript?: string; postResponseScript?: string; auth?: AuthConfig }>;
  /** `kind: 'graphql'` marks a source that distinguishes GraphQL
   *  requests as their own type (Bruno's `meta.type`) — landed as a
   *  GraphqlRequest when the surface has the leg, else as the HTTP
   *  request with a transform note. */
  requests: Array<{ folderPath: string[]; request: CurlRequest; kind?: 'graphql' }>;
}

/** Write legs the landing loop rides — the caller binds them to its
 *  surface's write plane (`useRequests` in the workbench). */
export interface CollectionLandingLegs {
  createCollection: (name: string) => Promise<{ uid: string; path: string } | null>;
  createFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string } | null>;
  setCollectionScripts?: (
    collectionUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;
  setFolderScripts?: (
    folderUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;
  setCollectionAuth?: (collectionUid: string, auth: AuthConfig) => Promise<boolean>;
  setFolderAuth?: (folderUid: string, auth: AuthConfig) => Promise<boolean>;
  setCollectionVariables?: (collectionUid: string, variables: Variable[]) => Promise<boolean>;
  createRequest: (payload: {
    name: string;
    parentPath: string;
    seed: Partial<Request>;
  }) => Promise<{ uid: string } | null>;
  /** Lands a GraphQL-typed source request as a GraphqlRequest entity.
   *  Absent on surfaces without the GraphQL plane — those requests
   *  then land as HTTP requests with the graphql body mode, noted. */
  createGraphqlRequest?: (payload: {
    name: string;
    parentPath: string;
    seed: GraphqlRequestContent;
  }) => Promise<{ uid: string } | null>;
}

export interface LandedCollections {
  collectionsImported: number;
  requestsImported: number;
  /** Created collection uids, indexed like the input sections —
   *  `null` where the collection create failed (drop recorded). */
  collectionUids: Array<string | null>;
}

export async function landSectionedCollections(
  sections: readonly SectionedCollection[],
  /** Per-section target names (user-edited); blank falls back to the
   *  section's own name. */
  names: readonly string[],
  legs: CollectionLandingLegs,
  report: ImportReport,
): Promise<LandedCollections> {
  let requestsImported = 0;
  let collectionsImported = 0;
  const collectionUids: Array<string | null> = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;
    const name = (names[i] ?? section.name).trim() || section.name;
    const coll = await legs.createCollection(name);
    if (!coll) {
      recordDrop(report, {
        path: `collections[${i}]`,
        reason: `Failed to create collection "${name}" — its requests were not imported.`,
        tracking: 'PERMANENT: write-path failure',
      });
      collectionUids.push(null);
      continue;
    }
    collectionsImported++;
    collectionUids.push(coll.uid);
    if (
      legs.setCollectionScripts &&
      (section.preRequestScript !== undefined || section.postResponseScript !== undefined)
    ) {
      await legs.setCollectionScripts(coll.uid, {
        ...(section.preRequestScript !== undefined ? { preRequestScript: section.preRequestScript } : {}),
        ...(section.postResponseScript !== undefined ? { postResponseScript: section.postResponseScript } : {}),
      });
    }
    if (legs.setCollectionAuth && section.auth !== undefined) {
      await legs.setCollectionAuth(coll.uid, section.auth);
    }
    if (section.variables !== undefined && section.variables.length > 0) {
      if (legs.setCollectionVariables) {
        const rows: Variable[] = section.variables.map((v) => ({
          uid: generateUid(),
          name: v.name,
          value: v.value,
          type: v.type,
        }));
        const landed = await legs.setCollectionVariables(coll.uid, rows);
        if (!landed) {
          recordDrop(report, {
            path: `collections[${i}].variables`,
            reason: `${rows.length} collection variable${rows.length === 1 ? '' : 's'} failed to write — set them on the collection's Variables page.`,
            tracking: 'PERMANENT: write-path failure',
          });
        }
      } else {
        recordDrop(report, {
          path: `collections[${i}].variables`,
          reason: `${section.variables.length} collection variable${section.variables.length === 1 ? '' : 's'} not imported — this surface has no collection-variable write leg.`,
          tracking: '#todo-file-import-collection-variables',
        });
      }
    }
    const folderPathMap = new Map<string, string>();
    folderPathMap.set('', coll.path);
    const sortedFolders = [...section.folders].sort((a, b) => a.path.length - b.path.length);
    for (const f of sortedFolders) {
      const parentKey = f.path.slice(0, -1).join('/');
      const parentPath = folderPathMap.get(parentKey);
      const folderName = f.path[f.path.length - 1];
      if (!parentPath || !folderName) continue;
      const created = await legs.createFolder(folderName, parentPath);
      if (created) {
        folderPathMap.set(f.path.join('/'), created.path);
        if (legs.setFolderScripts && (f.preRequestScript !== undefined || f.postResponseScript !== undefined)) {
          await legs.setFolderScripts(created.uid, {
            ...(f.preRequestScript !== undefined ? { preRequestScript: f.preRequestScript } : {}),
            ...(f.postResponseScript !== undefined ? { postResponseScript: f.postResponseScript } : {}),
          });
        }
        if (legs.setFolderAuth && f.auth !== undefined) {
          await legs.setFolderAuth(created.uid, f.auth);
        }
      }
    }
    for (const [index, { folderPath, request, kind }] of section.requests.entries()) {
      const parentPath = folderPathMap.get(folderPath.join('/')) ?? coll.path;
      const seed: Partial<Request> = {
        ...(request.description !== undefined ? { description: request.description } : {}),
        ...request.settings,
        ...(request.preRequestScript !== undefined ? { preRequestScript: request.preRequestScript } : {}),
        ...(request.postResponseScript !== undefined ? { postResponseScript: request.postResponseScript } : {}),
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        auth: request.auth,
        body: request.body,
      };
      if (kind === 'graphql') {
        const landed = await landGraphqlRequest(
          legs,
          request,
          parentPath,
          seed,
          `collections[${i}].requests[${index}]`,
          report,
        );
        if (landed) requestsImported += 1;
        continue;
      }
      const created = await legs.createRequest({ name: request.name, parentPath, seed });
      if (created) requestsImported += 1;
    }
  }
  return { collectionsImported, requestsImported, collectionUids };
}

/**
 * A GraphQL-typed source request: the GraphqlRequest entity through
 * the reverse bridge (the body's document + variables, the query rows
 * folded into the URL) when the surface has the leg and the body IS
 * graphql; otherwise the HTTP request with the graphql body mode,
 * with the reason on the report — never silently the other kind.
 */
async function landGraphqlRequest(
  legs: CollectionLandingLegs,
  request: CurlRequest,
  parentPath: string,
  seed: Partial<Request>,
  path: string,
  report: ImportReport,
): Promise<boolean> {
  const converted = legs.createGraphqlRequest
    ? fromHttpRequest({
        url: request.url,
        params: request.params,
        headers: request.headers,
        auth: request.auth,
        body: request.body,
        ...(request.description !== undefined ? { description: request.description } : {}),
        ...request.settings,
        ...(request.preRequestScript !== undefined ? { preRequestScript: request.preRequestScript } : {}),
        ...(request.postResponseScript !== undefined ? { postResponseScript: request.postResponseScript } : {}),
      })
    : null;
  if (legs.createGraphqlRequest && converted !== null) {
    const created = await legs.createGraphqlRequest({ name: request.name, parentPath, seed: converted.content });
    return created !== null;
  }
  recordTransform(report, {
    path,
    from: 'GraphQL request',
    to: 'HTTP request with a GraphQL body',
    reason: legs.createGraphqlRequest
      ? 'The request is typed GraphQL but carries no GraphQL body — landed as an HTTP request; convert it once its query is set.'
      : 'This surface has no GraphQL request plane — landed as an HTTP request with the GraphQL body mode.',
    tracking: 'PERMANENT: GraphQL request plane availability',
  });
  const created = await legs.createRequest({ name: request.name, parentPath, seed });
  return created !== null;
}
