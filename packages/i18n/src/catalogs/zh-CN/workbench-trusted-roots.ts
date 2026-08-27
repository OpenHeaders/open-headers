/**
 * Trusted-certificates family — the TrustedRootsEditor singleton tab
 * (`workbench/components/trusted-roots/`): the row table, the
 * paste → summary → Add flow and its refusals, the remove confirm.
 *
 * Raw by design inside keyed sentences: PEM / CA / PKI / TLS / SHA-256
 * vocabulary (glossary duty), {count} chain lengths, {message} parser
 * text.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': '受信任的证书',
  'workbench.trustedRoots.description':
    '此工作区内每个 TLS 连接除内置根证书外额外信任的证书颁发机构。公开材料——随工作区同步，绝非机密。',
  'workbench.trustedRoots.count': '证书（{count}）',
  'workbench.trustedRoots.empty': '还没有受信任的证书',
  'workbench.trustedRoots.emptyHint':
    '添加你的私有 CA 根证书，即可在不关闭验证的情况下访问自建 PKI 后面的服务器和 Broker。',
  'workbench.trustedRoots.add': '添加证书',
  'workbench.trustedRoots.header.name': '名称',
  'workbench.trustedRoots.header.subject': '主题',
  'workbench.trustedRoots.header.fingerprint': 'SHA-256 指纹',
  'workbench.trustedRoots.header.expires': '到期',
  'workbench.trustedRoots.row.chain': '{count} 级证书链',
  'workbench.trustedRoots.row.expired': '已过期',
  'workbench.trustedRoots.row.copyFingerprint': '复制指纹',
  'workbench.trustedRoots.row.copied': '已复制',
  'workbench.trustedRoots.row.remove': '移除',
  'workbench.trustedRoots.row.removeTitle': '移除此证书？',
  'workbench.trustedRoots.row.removeDescription': '依赖它的连接从下一次请求起将无法通过验证。',
  'workbench.trustedRoots.add.pemLabel': '证书（PEM）',
  'workbench.trustedRoots.add.pemPlaceholder': '粘贴 PEM 证书或证书链',
  'workbench.trustedRoots.add.nameLabel': '名称',
  'workbench.trustedRoots.add.namePlaceholder': '内部根 CA',
  'workbench.trustedRoots.add.summary.subject': '主题',
  'workbench.trustedRoots.add.summary.issuer': '颁发者',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': '生效时间',
  'workbench.trustedRoots.add.summary.validUntil': '到期时间',
  'workbench.trustedRoots.add.summary.chain': '证书链',
  'workbench.trustedRoots.add.parsing': '正在读取证书…',
  'workbench.trustedRoots.add.invalid': '不是证书：{message}',
  'workbench.trustedRoots.add.notCa': '这是服务器证书，不是证书颁发机构。请改为添加签发它的根证书或中间证书。',
  'workbench.trustedRoots.add.confirm': '添加',
  'workbench.trustedRoots.add.cancel': '取消',
  'workbench.trustedRoots.added': '证书已添加',
  'workbench.trustedRoots.addFailed': '添加证书失败',
  'workbench.trustedRoots.removed': '证书已移除',
  'workbench.trustedRoots.removeFailed': '移除证书失败',
} as const satisfies Catalog;
