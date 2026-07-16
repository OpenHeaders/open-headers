/**
 * Blank "New Specification" scaffold — the seed content for a spec
 * created from the sidebar.
 *
 * The template is the captured vendor scaffold recorded verbatim in
 * `docs/API_SPECS_SCAFFOLDS.md` (the spacecraft sample): one root
 * `index.yaml`, OpenAPI 3.1, fully parseable out of the box. v1 only
 * ever creates this single root file; the schema's multi-file shape is
 * exercised by future phases.
 */

import type { Spec } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';

export const SPEC_ROOT_FILE_NAME = 'index.yaml';

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

/**
 * Seed for `applySpecCreate`: a named OpenAPI 3.1 spec holding the one
 * root file. Mints the file uid and marks it as the document root.
 */
export function createBlankSpecSeed(name: string): Omit<Spec, 'uid' | 'path' | 'schemaVersion'> {
  const rootFileUid = generateUid();
  return {
    name,
    format: 'openapi-3.1',
    rootFileUid,
    files: [{ uid: rootFileUid, fileName: SPEC_ROOT_FILE_NAME, content: OPENAPI_31_SCAFFOLD }],
  };
}
