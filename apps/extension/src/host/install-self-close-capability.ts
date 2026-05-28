/**
 * `closeSurface` capability registration for surfaces that can dismiss
 * themselves — the popup window and the sidepanel both close cleanly
 * via `window.close()`. The devtools panel cannot, so it intentionally
 * does not import this module and shared UI's
 * `getCapability('closeSurface')?.()` no-ops there.
 *
 * Kept in its own file so each surface entry explicitly opts in by
 * importing it — no runtime "is this a popup?" branching.
 */

import { registerCapability } from '@openheaders/core/capabilities';

registerCapability('closeSurface', () => window.close());
