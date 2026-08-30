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
  'workbench.trustedRoots.row.rename': '重命名',
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
  'workbench.trustedRoots.saveFailed': '保存受信任的证书失败',
  'workbench.trustedRoots.saveFailedDetail': '保存受信任的证书失败：{message}',
  'workbench.trustedRoots.settings.label': '受信任证书 (CA)',
  'workbench.trustedRoots.settings.count': '来自此工作区 {count} 个',
  'workbench.trustedRoots.settings.none': '此工作区暂无',
  'workbench.trustedRoots.settings.manage': '管理受信任的证书',
  'workbench.trustedRoots.settings.empty': '此工作区暂无受信任的证书。',
  'workbench.trustedRoots.settings.browserStore': '浏览器证书库',
  'workbench.trustedRoots.settings.help':
    '此工作区在内置根之外额外信任的证书颁发机构——应用于应用运行时建立的每个 TLS 连接，每行一个根。请在此添加私有 CA，而不是关闭验证。',
  'workbench.trustedRoots.settings.deviceCount': '此设备上 {count} 个',
  'workbench.trustedRoots.settings.groupWorkspace': '此工作区',
  'workbench.trustedRoots.settings.groupDevice': '此设备',
  'workbench.trustedRoots.device.count': '此设备已固定（{count}）',
  'workbench.trustedRoots.device.empty': '此设备尚未固定任何证书',
  'workbench.trustedRoots.device.emptyHint': '固定通常来自一次失败的发送——仅在本机信任服务器出示的证书。也可以在此粘贴一个手动固定。',
  'workbench.trustedRoots.settings.browserNote':
    '浏览器使用自己的信任库进行验证；添加到此工作区的证书仅在应用运行时发送时生效。',
  'workbench.trustedRoots.systemTrust.count':
    '本机信任库中的 {count} 个证书将应用于应用运行时建立的每个 TLS 连接',
  'workbench.trustedRoots.systemTrust.off': '仅信任内置根证书和上方列出的证书',
  'workbench.trustedRoots.systemTrust.unsupported':
    '此运行时无法读取系统信任库——需要 Node 22.15 或更高版本',
  'workbench.trustedRoots.systemTrust.browser': '浏览器使用其自身的信任库进行验证',
} as const satisfies Catalog;
