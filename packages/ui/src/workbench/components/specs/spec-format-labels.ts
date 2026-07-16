/**
 * Presentation labels for the spec format picklist — product
 * vocabulary ("OpenAPI 3.1", "Protobuf 3"), deliberately not
 * localized. Shared by the editor's header badge and the sidebar's
 * create-new-spec menu so the two surfaces never drift.
 */

import type { SpecFormat } from '@openheaders/core/types';

export const SPEC_FORMAT_LABELS: Record<SpecFormat, string> = {
  'openapi-3.0': 'OpenAPI 3.0',
  'openapi-3.1': 'OpenAPI 3.1',
  protobuf: 'Protobuf 3',
};
