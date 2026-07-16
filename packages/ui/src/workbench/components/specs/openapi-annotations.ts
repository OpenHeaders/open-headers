/**
 * OpenAPI field annotations — the curated description catalog behind
 * the spec editor's hover (vendor parity: hovering a field shows the
 * specification's own description of it). Descriptions quote the
 * OpenAPI Specification's field tables; the text stays raw by the
 * parity-vocab rule — spec keywords and their standard docs are
 * technical vocabulary, not UI copy.
 *
 * Matching is a pattern walk over the document path from
 * `spec-doc-path.ts`: root-anchored patterns pin document positions
 * (`info.title`), floating patterns match the path's tail wherever the
 * object appears (`$ref`, parameter fields, response fields). First
 * match wins — the catalog orders specific before generic.
 */

import type { SpecDocSegment } from './spec-doc-path';

/** The OpenAPI formats the catalog annotates (protobuf has none). */
export type AnnotatedSpecFormat = 'openapi-3.0' | 'openapi-3.1';

interface SpecAnnotation {
  /** Path segments; `'*'` matches any single key or index. */
  pattern: string[];
  /** Match the path's tail instead of anchoring at the root. */
  floating?: boolean;
  /** Restrict to one format — absent annotates both. */
  formats?: AnnotatedSpecFormat[];
  text: string;
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function operationEntries(): SpecAnnotation[] {
  return HTTP_METHODS.map((method) => ({
    pattern: ['paths', '*', method],
    text: `A definition of a ${method.toUpperCase()} operation on this path.`,
  }));
}

/** Root-anchored entries — document positions. */
const ANCHORED: SpecAnnotation[] = [
  { pattern: ['openapi'], text: 'The version number of the OpenAPI Specification that this document uses.' },
  { pattern: ['info'], text: 'Metadata about the API, available for tooling and display.' },
  { pattern: ['info', 'title'], text: 'The title of the API.' },
  { pattern: ['info', 'summary'], formats: ['openapi-3.1'], text: 'A short summary of the API.' },
  { pattern: ['info', 'description'], text: 'A description of the API. CommonMark syntax MAY be used.' },
  {
    pattern: ['info', 'termsOfService'],
    text: 'A URL to the Terms of Service for the API. MUST be in the format of a URL.',
  },
  { pattern: ['info', 'contact'], text: 'The contact information for the exposed API.' },
  { pattern: ['info', 'contact', 'name'], text: 'The identifying name of the contact person or organization.' },
  { pattern: ['info', 'contact', 'url'], text: 'The URL pointing to the contact information.' },
  { pattern: ['info', 'contact', 'email'], text: 'The email address of the contact person or organization.' },
  { pattern: ['info', 'license'], text: 'The license information for the exposed API.' },
  { pattern: ['info', 'license', 'name'], text: 'The license name used for the API.' },
  {
    pattern: ['info', 'license', 'identifier'],
    formats: ['openapi-3.1'],
    text: 'An SPDX license expression for the API. Mutually exclusive with the url field.',
  },
  { pattern: ['info', 'license', 'url'], text: 'The URL pointing to the license.' },
  { pattern: ['info', 'version'], text: 'The version of this OpenAPI document, distinct from the API version.' },
  {
    pattern: ['jsonSchemaDialect'],
    formats: ['openapi-3.1'],
    text: 'The default value for the $schema keyword within Schema Objects in this document.',
  },
  { pattern: ['servers'], text: 'An array of Server Objects providing connectivity information to a target server.' },
  { pattern: ['servers', '*', 'url'], text: 'A URL to the target host. Supports server variables.' },
  { pattern: ['servers', '*', 'description'], text: 'An optional string describing the host designated by the URL.' },
  { pattern: ['servers', '*', 'variables'], text: 'A map of variables for substitution in the server URL template.' },
  { pattern: ['paths'], text: 'The available paths and operations for the API.' },
  { pattern: ['paths', '*'], text: 'A relative path to an individual endpoint, appended to the server URL.' },
  ...operationEntries(),
  {
    pattern: ['paths', '*', 'parameters'],
    text: 'A list of parameters applicable to every operation described under this path.',
  },
  { pattern: ['paths', '*', '*', 'summary'], text: 'A short summary of what the operation does.' },
  {
    pattern: ['paths', '*', '*', 'description'],
    text: 'A verbose explanation of the operation behavior. CommonMark syntax MAY be used.',
  },
  {
    pattern: ['paths', '*', '*', 'operationId'],
    text: 'A unique string used to identify the operation. MUST be unique among all operations in the API.',
  },
  { pattern: ['paths', '*', '*', 'tags'], text: 'A list of tags for API documentation control.' },
  { pattern: ['paths', '*', '*', 'deprecated'], text: 'Declares this operation to be deprecated.' },
  {
    pattern: ['paths', '*', '*', 'security'],
    text: 'A declaration of which security mechanisms can be used for this operation.',
  },
  {
    pattern: ['webhooks'],
    formats: ['openapi-3.1'],
    text: 'Incoming webhooks the API consumer may receive, described as Path Item Objects.',
  },
  { pattern: ['components'], text: 'An element to hold various reusable objects for the specification.' },
  { pattern: ['components', 'schemas'], text: 'An object to hold reusable Schema Objects.' },
  { pattern: ['components', 'responses'], text: 'An object to hold reusable Response Objects.' },
  { pattern: ['components', 'parameters'], text: 'An object to hold reusable Parameter Objects.' },
  { pattern: ['components', 'examples'], text: 'An object to hold reusable Example Objects.' },
  { pattern: ['components', 'requestBodies'], text: 'An object to hold reusable Request Body Objects.' },
  { pattern: ['components', 'headers'], text: 'An object to hold reusable Header Objects.' },
  { pattern: ['components', 'securitySchemes'], text: 'An object to hold reusable Security Scheme Objects.' },
  { pattern: ['components', 'links'], text: 'An object to hold reusable Link Objects.' },
  { pattern: ['components', 'callbacks'], text: 'An object to hold reusable Callback Objects.' },
  {
    pattern: ['components', 'pathItems'],
    formats: ['openapi-3.1'],
    text: 'An object to hold reusable Path Item Objects.',
  },
  {
    pattern: ['security'],
    text: 'A declaration of which security mechanisms can be used across the API. Individual operations can override it.',
  },
  { pattern: ['tags'], text: 'A list of tags used by the document with additional metadata.' },
  { pattern: ['tags', '*', 'name'], text: 'The name of the tag.' },
  { pattern: ['tags', '*', 'description'], text: 'A description for the tag. CommonMark syntax MAY be used.' },
  { pattern: ['externalDocs'], text: 'Additional external documentation.' },
];

/** Floating entries — objects that appear at many document positions.
 *  Ordered longest-tail first so the specific object wins over the
 *  generic keyword. */
const FLOATING: SpecAnnotation[] = [
  {
    pattern: ['parameters', '*', 'name'],
    floating: true,
    text: 'The name of the parameter. Parameter names are case sensitive.',
  },
  {
    pattern: ['parameters', '*', 'in'],
    floating: true,
    text: 'The location of the parameter. Possible values are "query", "header", "path" or "cookie".',
  },
  {
    pattern: ['parameters', '*', 'required'],
    floating: true,
    text: 'Determines whether this parameter is mandatory. For path parameters this MUST be true.',
  },
  {
    pattern: ['parameters', '*', 'schema'],
    floating: true,
    text: 'The schema defining the type used for the parameter.',
  },
  {
    pattern: ['parameters', '*', 'description'],
    floating: true,
    text: 'A brief description of the parameter. CommonMark syntax MAY be used.',
  },
  {
    pattern: ['parameters', '*', 'deprecated'],
    floating: true,
    text: 'Specifies that a parameter is deprecated and SHOULD be transitioned out of usage.',
  },
  {
    pattern: ['securitySchemes', '*', 'type'],
    floating: true,
    text: 'The type of the security scheme. Valid values are "apiKey", "http", "mutualTLS", "oauth2", "openIdConnect".',
  },
  {
    pattern: ['securitySchemes', '*', 'name'],
    floating: true,
    text: 'The name of the header, query or cookie parameter to be used.',
  },
  {
    pattern: ['securitySchemes', '*', 'in'],
    floating: true,
    text: 'The location of the API key. Valid values are "query", "header" or "cookie".',
  },
  {
    pattern: ['securitySchemes', '*', 'scheme'],
    floating: true,
    text: 'The name of the HTTP Authorization scheme to be used, as defined in RFC 7235.',
  },
  {
    pattern: ['securitySchemes', '*', 'bearerFormat'],
    floating: true,
    text: 'A hint to the client to identify how the bearer token is formatted.',
  },
  {
    pattern: ['securitySchemes', '*', 'flows'],
    floating: true,
    text: 'Configuration information for the flow types supported by the OAuth scheme.',
  },
  {
    pattern: ['securitySchemes', '*', 'openIdConnectUrl'],
    floating: true,
    text: 'A URL to discover OpenID Connect configuration values. MUST be in the form of a URL.',
  },
  {
    pattern: ['responses', '*', 'description'],
    floating: true,
    text: 'A description of the response. CommonMark syntax MAY be used.',
  },
  {
    pattern: ['responses', '*', 'content'],
    floating: true,
    text: 'A map containing descriptions of potential response payloads, keyed by media type.',
  },
  { pattern: ['responses', '*', 'headers'], floating: true, text: 'Maps a header name to its definition.' },
  {
    pattern: ['requestBody', 'description'],
    floating: true,
    text: 'A brief description of the request body. CommonMark syntax MAY be used.',
  },
  {
    pattern: ['requestBody', 'content'],
    floating: true,
    text: 'The content of the request body, keyed by media type.',
  },
  {
    pattern: ['requestBody', 'required'],
    floating: true,
    text: 'Determines if the request body is required in the request.',
  },
  {
    pattern: ['content', '*', 'schema'],
    floating: true,
    text: 'The schema defining the content of the request, response, or parameter.',
  },
  {
    pattern: ['content', '*', 'example'],
    floating: true,
    text: 'An example of the media type in the media type format.',
  },
  { pattern: ['content', '*', 'examples'], floating: true, text: 'Examples of the media type, keyed by name.' },
  { pattern: ['responses'], floating: true, text: 'The possible responses returned from executing this operation.' },
  { pattern: ['requestBody'], floating: true, text: 'The request body applicable for this operation.' },
  { pattern: ['$ref'], floating: true, text: 'The reference string.' },
  { pattern: ['type'], floating: true, text: 'The data type of the schema.' },
  { pattern: ['format'], floating: true, text: 'The extending format for the data type.' },
  { pattern: ['properties'], floating: true, text: 'The properties of the object schema, keyed by name.' },
  { pattern: ['required'], floating: true, text: 'The list of properties an instance of this schema must carry.' },
  { pattern: ['enum'], floating: true, text: 'An enumeration of the values this element allows.' },
  { pattern: ['items'], floating: true, text: 'The schema describing the items of the array.' },
  { pattern: ['allOf'], floating: true, text: 'The instance must validate against all of these schemas.' },
  { pattern: ['anyOf'], floating: true, text: 'The instance must validate against at least one of these schemas.' },
  { pattern: ['oneOf'], floating: true, text: 'The instance must validate against exactly one of these schemas.' },
  {
    pattern: ['nullable'],
    floating: true,
    formats: ['openapi-3.0'],
    text: 'Allows sending a null value for the defined schema.',
  },
  { pattern: ['externalDocs'], floating: true, text: 'Additional external documentation for this element.' },
  { pattern: ['summary'], floating: true, text: 'A short summary of this element.' },
  {
    pattern: ['description'],
    floating: true,
    text: 'A description of this element. CommonMark syntax MAY be used for rich text representation.',
  },
];

const CATALOG: SpecAnnotation[] = [...ANCHORED, ...FLOATING];

function segmentMatches(patternSegment: string, segment: SpecDocSegment): boolean {
  return patternSegment === '*' || patternSegment === String(segment);
}

function patternMatches(entry: SpecAnnotation, path: SpecDocSegment[]): boolean {
  const { pattern } = entry;
  if (entry.floating === true) {
    if (path.length < pattern.length) return false;
    const tail = path.slice(path.length - pattern.length);
    return pattern.every((segment, i) => segmentMatches(segment, tail[i]));
  }
  return pattern.length === path.length && pattern.every((segment, i) => segmentMatches(segment, path[i]));
}

/**
 * The specification's description for the field at `path`, or null
 * when the catalog has no opinion. Anchored entries win over floating;
 * within each list, source order is specificity order.
 */
export function lookupSpecAnnotation(path: SpecDocSegment[], format: AnnotatedSpecFormat): string | null {
  if (path.length === 0) return null;
  for (const entry of CATALOG) {
    if (entry.formats !== undefined && !entry.formats.includes(format)) continue;
    if (patternMatches(entry, path)) return entry.text;
  }
  return null;
}
