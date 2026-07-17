/**
 * Release-channel `react/jsx-runtime` replacement — drops the
 * `data-testid` attribute at element creation, so e2e selectors never
 * ship in release packages. Wired via a build-time alias in
 * `vite.config.ts`; dev and store builds use the real runtime and keep
 * the ids. Catches every origin — app JSX, prebuilt `@openheaders/ui`
 * dist, spread props — because all of them create elements through
 * this runtime. The pass-through imports resolve to React's real
 * module via the `react/jsx-runtime-actual` alias.
 */

import type { ElementType, Key, ReactElement } from 'react';
import { Fragment as ReactFragment, jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime-actual';

type JsxProps = Record<string, unknown> | null | undefined;

function strip(props: JsxProps): JsxProps {
  if (props && 'data-testid' in props) {
    const { 'data-testid': _testid, ...rest } = props;
    return rest;
  }
  return props;
}

export const Fragment = ReactFragment;

export function jsx(type: ElementType, props: JsxProps, key?: Key): ReactElement {
  return reactJsx(type, strip(props), key);
}

export function jsxs(type: ElementType, props: JsxProps, key?: Key): ReactElement {
  return reactJsxs(type, strip(props), key);
}
