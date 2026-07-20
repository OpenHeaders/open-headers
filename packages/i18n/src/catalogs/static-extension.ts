/**
 * Statically-bundled `extension.badge.*` slices per locale. The MV3
 * service worker cannot dynamic-import, so the badge family ships
 * inside the SW bundle: one static import per locale's `extension`
 * catalog file — never the locale's full lazy chunk. Consumers compose
 * a translator from the slice with the English catalog as per-key
 * fallback.
 */

import type { Catalog } from '../types';
import { extension as extensionDe } from './de/extension';
import { extension as extensionEs } from './es/extension';
import { extension as extensionFr } from './fr/extension';
import { extension as extensionZhCn } from './zh-CN/extension';

export const STATIC_EXTENSION_CATALOGS: Readonly<Record<string, Catalog>> = {
  de: extensionDe,
  es: extensionEs,
  fr: extensionFr,
  'zh-CN': extensionZhCn,
};
