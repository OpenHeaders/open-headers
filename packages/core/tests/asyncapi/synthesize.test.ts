/**
 * Example-payload synthesis — "Use example message" ground truth over
 * the ratified JSON-Schema subset. Pins the contract: authored
 * `examples`/`const`/`default`/`enum` values beat type-driven samples
 * (in that precedence), strings echo their property name, numbers are
 * 1, booleans true, arrays carry one sample item, nested `$ref`s
 * resolve against component schema bodies with cycles cut to `{}`, and
 * combinator nodes are unsupported — omitted as properties, null at
 * the root.
 */

import { parseAsyncApi, synthesizeExamplePayload } from '@openheaders/core/asyncapi';
import { describe, expect, it } from 'vitest';

const DOC = `asyncapi: 3.0.0
info:
  title: Openheaders Streetlights
channels:
  lightingMeasured:
    address: streams/lighting
    messages:
      lightMeasured:
        payload:
          type: object
          properties:
            id:
              type: string
            lumens:
              type: integer
            enabled:
              type: boolean
            mode:
              enum: [auto, manual]
            unit:
              const: lm
            interval:
              type: number
              default: 30
            tags:
              type: array
              items:
                type: string
            sensor:
              $ref: '#/components/schemas/Sensor'
            mixed:
              oneOf:
                - type: string
                - type: number
      authored:
        payload:
          type: object
          examples:
            - id: light-7
              lumens: 900
components:
  schemas:
    Sensor:
      type: object
      properties:
        serial:
          type: string
        parent:
          $ref: '#/components/schemas/Sensor'
`;

describe('synthesizeExamplePayload', () => {
  const census = parseAsyncApi(DOC);
  const messageOf = (name: string) => census.channels[0].messages.find((message) => message.name === name) ?? null;

  it('synthesizes the subset shape with authored values winning', () => {
    const payload = messageOf('lightMeasured')?.payload;
    const result = synthesizeExamplePayload(payload, census.componentSchemas);
    expect(result).toEqual({
      value: {
        id: 'id',
        lumens: 1,
        enabled: true,
        mode: 'auto',
        unit: 'lm',
        interval: 30,
        tags: ['tags'],
        sensor: { serial: 'serial', parent: {} },
        // `mixed` omitted — combinator nodes are outside the subset.
      },
    });
  });

  it('returns a document-authored example verbatim', () => {
    const payload = messageOf('authored')?.payload;
    expect(synthesizeExamplePayload(payload, census.componentSchemas)).toEqual({
      value: { id: 'light-7', lumens: 900 },
    });
  });

  it('returns null for absent payloads and root combinators', () => {
    expect(synthesizeExamplePayload(null, census.componentSchemas)).toBeNull();
    expect(synthesizeExamplePayload({ anyOf: [{ type: 'string' }] }, census.componentSchemas)).toBeNull();
  });

  it('distinguishes a synthesized null from nothing to synthesize', () => {
    expect(synthesizeExamplePayload({ const: null }, [])).toEqual({ value: null });
    expect(synthesizeExamplePayload({ type: 'null' }, [])).toEqual({ value: null });
  });

  it('resolves unknown component refs to unsupported', () => {
    expect(synthesizeExamplePayload({ $ref: '#/components/schemas/Missing' }, census.componentSchemas)).toBeNull();
  });
});
