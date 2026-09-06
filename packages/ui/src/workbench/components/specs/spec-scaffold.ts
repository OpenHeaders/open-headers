/**
 * Blank "New Specification" scaffolds — the seed content for a spec
 * created from the sidebar, one per creatable format.
 *
 * The OpenAPI template is the captured vendor scaffold recorded
 * verbatim in the API-specs scaffolds doc (the spacecraft sample):
 * one root `index.yaml`, OpenAPI 3.1, fully parseable out of the box.
 * The Protobuf template is a proto3 library sample covering all four
 * rpc call shapes plus nested/enum/map/oneof anatomy, so the outline
 * and the future method selector demonstrate themselves on a fresh
 * spec. The AsyncAPI template is a 3.0 live-events sample covering
 * servers (protocol chips) / channels / send+receive operations /
 * component messages and schemas with `$ref`s, so every outline group
 * demonstrates itself. The GraphQL template is an SDL notes sample
 * covering every outline group — the three root types, object /
 * interface / union / enum / input / scalar types and a directive.
 * Creation only ever mints the single root file; the schema's
 * multi-file shape is exercised by future phases.
 */

import type { Spec, SpecFormat } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  GRAPHQL_INTROSPECTION_ROOT_FILE_NAME,
  GRAPHQL_SDL_ROOT_FILE_NAME,
  graphqlSchemaSourceKind,
  isGraphqlSchemaFileName,
} from './graphql-schema-source';

export const SPEC_ROOT_FILE_NAME = 'index.yaml';
export const JSON_SPEC_ROOT_FILE_NAME = 'index.json';
export const PROTO_SPEC_ROOT_FILE_NAME = 'index.proto';

export const OPENAPI_31_SCAFFOLD = `openapi: '3.1.0'
info:
  version: '1.0.0'
  title: 'Sample API'
  description: Buy or rent spacecrafts

paths:
  /spacecrafts/{spacecraftId}:
    parameters:
      - name: spacecraftId
        description: The unique identifier of the spacecraft
        in: path
        required: true
        schema:
          $ref: '#/components/schemas/SpacecraftId'
    get:
      summary: Read a spacecraft
      responses:
        '200':
          description: The spacecraft corresponding to the provided \`spacecraftId\`
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Spacecraft'
        '404':
          description: No spacecraft found for the provided \`spacecraftId\`
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '500':
          description: Unexpected error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    SpacecraftId:
      description: The unique identifier of a spacecraft
      type: string
    Spacecraft:
      type: object
      required:
        - id
        - name
        - type
      properties:
        id:
          $ref: '#/components/schemas/SpacecraftId'
        name:
          type: string
        type:
          type: string
          enum:
            - capsule
            - probe
            - satellite
            - spaceplane
            - station
        description:
          type: string
    Error:
      type: object
      required:
        - message
      properties:
        message:
          description: A human readable error message
          type: string
  securitySchemes:
    ApiKey:
      type: apiKey
      in: header
      name: X-Api-Key
security:
  - ApiKey: []
`;

export const PROTO3_SCAFFOLD = `syntax = "proto3";

package sample.library.v1;

import "google/protobuf/timestamp.proto";

// Sample catalog service covering the four gRPC call shapes.
service LibraryService {
  // Unary: one request, one response.
  rpc GetBook(GetBookRequest) returns (Book);
  // Server streaming: one request, a stream of responses.
  rpc ListBooks(ListBooksRequest) returns (stream Book);
  // Client streaming: a stream of requests, one response.
  rpc AddBooks(stream AddBookRequest) returns (AddBooksSummary);
  // Bidirectional streaming: both sides stream.
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}

message Book {
  string id = 1;
  string title = 2;
  repeated string authors = 3;
  Genre genre = 4;
  google.protobuf.Timestamp published_at = 5;
  map<string, string> labels = 6;

  oneof availability {
    bool in_stock = 7;
    google.protobuf.Timestamp restock_at = 8;
  }
}

enum Genre {
  GENRE_UNSPECIFIED = 0;
  FICTION = 1;
  REFERENCE = 2;
}

message GetBookRequest {
  string id = 1;
}

message ListBooksRequest {
  optional Genre genre = 1;
  uint32 page_size = 2;
}

message AddBookRequest {
  Book book = 1;
}

message AddBooksSummary {
  uint32 added = 1;
}

message ChatMessage {
  string text = 1;
}
`;

export const ASYNCAPI_30_SCAFFOLD = `asyncapi: 3.0.0
info:
  title: Live Events API
  version: 1.0.0
  description: Real-time event stream over WebSocket

servers:
  production:
    host: ws.openheaders.com
    protocol: wss
    description: Public event stream
  development:
    host: localhost:8080
    protocol: ws
    description: Local playground

channels:
  events:
    address: /ws/events
    description: The event feed — subscribe, then events arrive.
    messages:
      subscribe:
        $ref: '#/components/messages/Subscribe'
      event:
        $ref: '#/components/messages/Event'
  control:
    address: /ws/control
    messages:
      ping:
        name: ping
        payload:
          type: object
          properties:
            op:
              const: ping

operations:
  sendSubscribe:
    action: send
    channel:
      $ref: '#/channels/events'
    summary: Subscribe to one or more event topics
  onEvent:
    action: receive
    channel:
      $ref: '#/channels/events'
    summary: An event arrives on a subscribed topic
  sendPing:
    action: send
    channel:
      $ref: '#/channels/control'
    summary: Keep the session alive

components:
  messages:
    Subscribe:
      summary: Topic subscription request
      payload:
        type: object
        required:
          - topics
        properties:
          topics:
            type: array
            items:
              type: string
            examples:
              - [orders, trades]
          format:
            enum: [full, compact]
            default: full
    Event:
      summary: One event on a subscribed topic
      payload:
        $ref: '#/components/schemas/Event'
  schemas:
    Event:
      type: object
      required:
        - topic
        - sequence
      properties:
        topic:
          type: string
        sequence:
          type: integer
        payload:
          type: object
`;

export const GRAPHQL_SDL_SCAFFOLD = `"""
Sample notes API — every construct the GraphQL client's explorer,
completion and validation read.
"""
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

"""An ISO-8601 date-time string."""
scalar DateTime

"""Anything with a globally unique id."""
interface Node {
  id: ID!
}

"""A person with an account."""
type User implements Node {
  id: ID!
  name: String!
  email: String!
  role: Role!
  """Notes the user authored, newest first."""
  notes(first: Int = 10, after: String): [Note!]!
}

"""A note attached to a request or folder."""
type Note implements Node {
  id: ID!
  title: String!
  body: String
  tags: [String!]!
  author: User!
  createdAt: DateTime!
}

"""A user's role inside a workspace."""
enum Role {
  OWNER
  EDITOR
  VIEWER
}

"""Anything a search can find."""
union SearchResult = User | Note

"""The fields a new note carries."""
input NoteInput {
  title: String!
  body: String
  tags: [String!] = []
  authorId: ID!
}

type Query {
  """The signed-in user, or null when anonymous."""
  viewer: User
  """One user by id."""
  user(id: ID!): User
  """Full-text search across users and notes."""
  search(term: String!, limit: Int = 5): [SearchResult!]!
}

type Mutation {
  """Creates a note."""
  createNote(input: NoteInput!): Note!
  """Deletes a note; true when it existed."""
  deleteNote(id: ID!): Boolean!
}

type Subscription {
  """Fires for every note created."""
  noteCreated: Note!
}

"""Marks a field as expensive to resolve."""
directive @cost(weight: Int! = 1) on FIELD_DEFINITION
`;

/** The formats the sidebar's create menu offers. */
export type SpecCreateFormat = Extract<SpecFormat, 'openapi-3.1' | 'protobuf' | 'asyncapi' | 'graphql'>;

/** Each creatable format's blank root file. */
const BLANK_ROOTS: Record<SpecCreateFormat, { fileName: string; content: string }> = {
  'openapi-3.1': { fileName: SPEC_ROOT_FILE_NAME, content: OPENAPI_31_SCAFFOLD },
  protobuf: { fileName: PROTO_SPEC_ROOT_FILE_NAME, content: PROTO3_SCAFFOLD },
  asyncapi: { fileName: SPEC_ROOT_FILE_NAME, content: ASYNCAPI_30_SCAFFOLD },
  graphql: { fileName: GRAPHQL_SDL_ROOT_FILE_NAME, content: GRAPHQL_SDL_SCAFFOLD },
};

/**
 * Seed for `applySpecCreate`: a named spec of the chosen format
 * holding the one root file. Mints the file uid and marks it as the
 * document root.
 */
export function createBlankSpecSeed(
  name: string,
  format: SpecCreateFormat = 'openapi-3.1',
): Omit<Spec, 'uid' | 'path' | 'schemaVersion'> {
  const rootFileUid = generateUid();
  const { fileName, content } = BLANK_ROOTS[format];
  return {
    name,
    format,
    rootFileUid,
    files: [{ uid: rootFileUid, fileName, content }],
  };
}

function isJsonDocument(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seed for `applySpecCreate` from an imported OpenAPI document (import
 * hub "Specification with a Collection", Insomnia `api_spec`
 * retention). The source lands verbatim as the single root file; the
 * extension follows the document's syntax so language derivation
 * (invariant #15) reads it right.
 */
/**
 * Seed for `applySpecCreate` from an imported .proto file (the gRPC
 * editor's method-selector import action). The source lands verbatim
 * as the single root file under its original file name, so intra-file
 * import paths keep meaning what they meant on disk.
 */
export function createImportedProtoSpecSeed(
  name: string,
  fileName: string,
  content: string,
): Omit<Spec, 'uid' | 'path' | 'schemaVersion'> {
  const rootFileUid = generateUid();
  return {
    name,
    format: 'protobuf',
    rootFileUid,
    files: [{ uid: rootFileUid, fileName, content }],
  };
}

/**
 * Seed for `applySpecCreate` from an imported GraphQL schema file (the
 * GraphQL editor's Schema tab / explorer import action). SDL or an
 * introspection result, verbatim as the single root file; the file
 * keeps its own name when its extension names the syntax, else the
 * root takes the canonical name for the syntax the text sniffs as —
 * the extension picks the parser (invariant #15).
 */
export function createImportedGraphqlSpecSeed(
  name: string,
  fileName: string,
  content: string,
): Omit<Spec, 'uid' | 'path' | 'schemaVersion'> {
  const rootFileUid = generateUid();
  const canonical =
    graphqlSchemaSourceKind(content) === 'introspection'
      ? GRAPHQL_INTROSPECTION_ROOT_FILE_NAME
      : GRAPHQL_SDL_ROOT_FILE_NAME;
  return {
    name,
    format: 'graphql',
    rootFileUid,
    files: [{ uid: rootFileUid, fileName: isGraphqlSchemaFileName(fileName) ? fileName : canonical, content }],
  };
}

export function createImportedSpecSeed(
  name: string,
  content: string,
  format: Extract<SpecFormat, 'openapi-3.0' | 'openapi-3.1'>,
): Omit<Spec, 'uid' | 'path' | 'schemaVersion'> {
  const rootFileUid = generateUid();
  const fileName = isJsonDocument(content) ? JSON_SPEC_ROOT_FILE_NAME : SPEC_ROOT_FILE_NAME;
  return {
    name,
    format,
    rootFileUid,
    files: [{ uid: rootFileUid, fileName, content }],
  };
}
