/**
 * The error-report `surface` picklist mirrors the workbench's unit
 * unions (`TabMode` ∪ `ToolWindowId`) as its own list in core, so a
 * new unit is also a deliberate disclosure addition there. Core never
 * imports ui; this host test is where the two meet. The pin is
 * type-level (the unions have no runtime array): divergence either
 * way fails typecheck.
 */

import { type ErrorReportSurface, ErrorReportSurfaceSchema } from '@openheaders/core/telemetry';
import type { TabMode, ToolWindowId } from '@openheaders/ui/workbench/types';
import { describe, expect, it } from 'vitest';

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const surfaceMirrorsWorkbenchUnits: MutuallyAssignable<ErrorReportSurface, TabMode | ToolWindowId> = true;

describe('error report surface mirror', () => {
  it('keeps ErrorReportSurface identical to TabMode ∪ ToolWindowId', () => {
    expect(surfaceMirrorsWorkbenchUnits).toBe(true);
    const options = [...ErrorReportSurfaceSchema.options];
    expect(new Set(options).size).toBe(options.length);
  });
});
