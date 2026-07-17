/**
 * gRPC status vocabulary parity — every canonical code (0–16) the core
 * wire layer names must resolve a REAL catalog description in the
 * status pill's popover (never the unknown-code fallback), and the
 * description must name its own code. Pins the three-way join between
 * `GRPC_STATUS_NAMES`, the MetaStrip's per-name key map, and the en
 * catalog, so a drift in any one surfaces here instead of as a wrong
 * popover.
 */

import { GRPC_STATUS_NAMES, grpcStatusLabel } from '@openheaders/core/proto';
import { getTranslator } from '@openheaders/i18n';
import { grpcStatusInfoContent } from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcMetaStrip';
import { describe, expect, it } from 'vitest';

const t = getTranslator('en');

describe('grpc status catalog parity', () => {
  it('covers all 17 canonical codes with their own descriptions', () => {
    const fallback = t('workbench.editors.grpc.status.desc.unknownCode');
    for (let code = 0; code <= 16; code++) {
      const content = grpcStatusInfoContent(t, code);
      expect(content.title).toBe(grpcStatusLabel(code));
      expect(content.summary).not.toBe(fallback);
      expect(content.summary).toContain(`Status code ${code} ${GRPC_STATUS_NAMES[code]} is`);
    }
  });

  it('answers a non-standard code with the honest fallback', () => {
    const content = grpcStatusInfoContent(t, 42);
    expect(content.title).toBe('42');
    expect(content.summary).toBe(t('workbench.editors.grpc.status.desc.unknownCode'));
  });
});
