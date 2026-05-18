/**
 * Compatibility re-export — the docs-nav context now lives in
 * `@openheaders/ui/shared/docs/use-docs-nav`. Workbench callsites
 * still import the old names from here; new code should import
 * from the shared module directly.
 */

import {
  DocsNavProvider,
  type DocsNavContextValue,
  useDocsNav,
  useOptionalDocsNav,
} from '@openheaders/ui/shared/docs/use-docs-nav';

export type InspectorNavContextValue = DocsNavContextValue;

export const InspectorNavProvider = DocsNavProvider;

export const useInspectorNav = useDocsNav;

export const useOptionalInspectorNav = useOptionalDocsNav;
