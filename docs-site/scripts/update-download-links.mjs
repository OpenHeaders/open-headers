#!/usr/bin/env node
/**
 * Release-versioned link refresh for the docs pages that pin a tag:
 * download links (`updates.openheaders.com/dl/v<tag>/…`) and the
 * `ghcr.io/openheaders/ohd:<tag>` image references. Reads the stable
 * feed, rewrites every pin to the current release, and probes each
 * rewritten URL/tag before anything lands on disk — a link never ships
 * unverified. Part of the release ritual (run after a promotion), not
 * of CI: the drift gate stays network-free.
 *
 * Run: node docs-site/scripts/update-download-links.mjs [--check]
 * --check probes without writing (exit 1 when pages are stale).
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEED = 'https://updates.openheaders.com/versions/stable.json';
const CHECK_ONLY = process.argv.includes('--check');

const fetchOk = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res;
};

const feed = await (await fetchOk(FEED)).json();
const desktopVersion = feed.desktop?.latest;
const daemonVersion = feed.daemon?.latest;
if (!/^\d{4}\.\d+\.\d+$/.test(desktopVersion ?? '') || !/^\d{4}\.\d+\.\d+$/.test(daemonVersion ?? '')) {
  throw new Error(`feed did not yield CalVer versions (desktop=${desktopVersion}, daemon=${daemonVersion})`);
}

/** Every .mdx page under docs-site (scripts and assets excluded). */
function mdxPages(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'scripts' && entry.name !== 'images' && entry.name !== 'logo') {
      out.push(...mdxPages(full));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      out.push(full);
    }
  }
  return out;
}

const VERSION = /\d{4}\.\d+\.\d+/g;
const probes = new Set();
let stale = 0;

const rewrites = [];
for (const file of mdxPages(DOCS_ROOT)) {
  const text = readFileSync(file, 'utf8');
  let next = text;
  // Download links: the whole URL carries the tag twice (path + asset name).
  next = next.replace(/https:\/\/updates\.openheaders\.com\/dl\/v[^)\s"]+/g, (url) => {
    const fresh = url.replace(VERSION, desktopVersion);
    probes.add(fresh);
    return fresh;
  });
  // Container image pins.
  next = next.replace(/ghcr\.io\/openheaders\/ohd:\d{4}\.\d+\.\d+/g, () => {
    probes.add(`ghcr:${daemonVersion}`);
    return `ghcr.io/openheaders/ohd:${daemonVersion}`;
  });
  if (next !== text) {
    stale++;
    rewrites.push({ file, next });
  }
}

// Probe every URL/tag the pages will carry BEFORE writing anything.
for (const probe of probes) {
  if (probe.startsWith('ghcr:')) {
    const tag = probe.slice(5);
    const token = (
      await (await fetchOk('https://ghcr.io/token?scope=repository:openheaders/ohd:pull&service=ghcr.io')).json()
    ).token;
    await fetchOk(`https://ghcr.io/v2/openheaders/ohd/manifests/${tag}`, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json',
      },
    });
    console.log(`ok  ghcr.io/openheaders/ohd:${tag}`);
  } else {
    await fetchOk(probe, { method: 'HEAD' });
    console.log(`ok  ${probe}`);
  }
}

if (stale === 0) {
  console.log(`up to date — every pin already at desktop ${desktopVersion} / daemon ${daemonVersion}`);
} else if (CHECK_ONLY) {
  console.error(`${stale} page(s) pin an old release — run without --check to rewrite`);
  process.exitCode = 1;
} else {
  for (const { file, next } of rewrites) {
    writeFileSync(file, next);
    console.log(`updated ${path.relative(DOCS_ROOT, file)}`);
  }
  console.log(`pinned desktop ${desktopVersion} / daemon ${daemonVersion} across ${stale} page(s)`);
}
