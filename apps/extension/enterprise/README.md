# Enterprise deployment — browser policy templates

Ready-to-edit policy artifacts for deploying the Open Headers
extension across a managed fleet: force-install, native-messaging
allowlisting, and the managed settings keys that lock the extension's
desktop-pairing and telemetry consent posture.

## The policy keys

All four keys are booleans, declared for Chromium browsers in the
extension's `managed_schema.json` and delivered to Firefox as managed
storage. A key present in policy renders its Settings row locked with
a MANAGED badge; users cannot change or reset it.

| Key | Locks |
| --- | --- |
| `backend.nmAutoJoin` | Whether this browser silently pairs with the Open Headers desktop app on the same machine (the desktop verifies the calling browser through the operating system before granting access). |
| `backend.nmAutoJoinProbe` | The periodic background check for a newly installed desktop app. |
| `backend.requireNmIdentity` | The verified-pairing requirement: when `true`, pairing codes and pasted tokens are refused for the desktop app — only the OS-verified native-messaging handoff can mint desktop credentials. Remote self-hosted back-ends are unaffected. |
| `backend.allowDesktopWatch` | Telemetry consent: whether a paired desktop app may watch this browser's network traffic, storage, and console. `false` keeps rules and sync working while live views are refused. |

The recommended fleet posture is in every template: auto-join on and
locked, verified pairing required, desktop watch locked to your
organization's choice. Every key is optional — ship only the ones you
lock.

The native-messaging host the desktop app registers is
`io.openheaders.nm_bootstrap`; the desktop app writes its manifests
itself on every boot, so no manifest deployment is needed on managed
machines that run the desktop app. The `NativeMessagingAllowlist`
entries in the templates are only needed when your fleet blocks native
messaging by default (`NativeMessagingBlocklist` = `*`).

## Extension ids

| Browser | Id | Source |
| --- | --- | --- |
| Chrome / Chrome Beta / Brave | `ablaikadpbfblkmhpmbbnbbfjoibeejb` | Chrome Web Store |
| Edge | `gnbibobkkddlflknjkgcmokdlpddegpo` | Edge Add-ons |
| Firefox | `{2c14f276-673b-4078-a575-8acf9d0579fa}` | AMO (gecko id) |

## macOS

Copy the plist **file** into `/Library/Managed Preferences/` — do NOT
use `defaults write`, which silently refuses in that directory
(`cfprefsd` treats it as MDM territory), and the directory may not
exist at all:

```sh
sudo mkdir -p "/Library/Managed Preferences"
sudo cp com.google.Chrome.extensions.ablaikadpbfblkmhpmbbnbbfjoibeejb.plist "/Library/Managed Preferences/"
sudo chown root:wheel "/Library/Managed Preferences/"*.plist
sudo chmod 644 "/Library/Managed Preferences/"*.plist
sudo killall cfprefsd
```

Then fully relaunch the browser. Under MDM, deploy the same domains as
custom configuration profiles instead.

- Extension-scope templates (the four settings keys):
  `macos/com.google.Chrome.extensions.<id>.plist`,
  `macos/com.microsoft.Edge.extensions.<id>.plist`,
  `macos/com.brave.Browser.extensions.<id>.plist`. Chrome Beta reads
  the `com.google.Chrome.beta.extensions.<id>` domain — duplicate the
  Chrome template under that name.
- Browser-scope templates (force-install + NM allowlist):
  `macos/com.google.Chrome.plist`, `macos/com.microsoft.Edge.plist`,
  `macos/com.brave.Browser.plist`. **Merge** these keys into your
  existing browser policy if you already manage one — copying the file
  as-is replaces the whole domain.
- Firefox managed storage has no plist: place
  `firefox/{2c14f276-673b-4078-a575-8acf9d0579fa}.json` at
  `~/Library/Application Support/Mozilla/ManagedStorage/{2c14f276-673b-4078-a575-8acf9d0579fa}.json`
  (per-user) or `/Library/Application Support/Mozilla/ManagedStorage/`
  (system-wide), then reload the extension or restart Firefox.

## Windows

Import the `.reg` files (they use HKLM for Chromium policy — run
elevated), or push the same values via GPO/Intune:

- `windows/openheaders-chrome.reg` — Chrome (all channels read the
  stable key).
- `windows/openheaders-edge.reg` — Edge.
- `windows/openheaders-brave.reg` — Brave.
- `windows/openheaders-firefox-managedstorage.reg` — points Firefox's
  ManagedStorage at a copy of `firefox/{2c14f276-673b-4078-a575-8acf9d0579fa}.json`;
  place that JSON at the path the registry value names (the template
  uses `C:\ProgramData\OpenHeaders\`).

## Linux

Chromium browsers read managed policy JSON from fixed system
directories — drop a file carrying the same keys as the Windows/macOS
templates (any filename ending in `.json`), owned by root:

- Chrome: `/etc/opt/chrome/policies/managed/`
- Chromium (distro package): `/etc/chromium/policies/managed/`
  (Debian/Ubuntu also read `/etc/chromium-browser/policies/managed/`)
- Edge: `/etc/opt/edge/policies/managed/`
- Brave: `/etc/brave/policies/managed/`

One JSON file can carry both scopes: browser-scope keys
(`ExtensionInstallForcelist`, `NativeMessagingAllowlist`) at top
level, and the four extension-scope settings keys under
`3rdparty.extensions.<id>` — Linux Chromium's equivalent of the
macOS `…extensions.<id>` plist domain and the Windows
`3rdparty\extensions\<id>\policy` registry path:

```json
{
  "3rdparty": {
    "extensions": {
      "ablaikadpbfblkmhpmbbnbbfjoibeejb": {
        "backend.nmAutoJoin": true,
        "backend.requireNmIdentity": true
      }
    }
  }
}
```

Firefox on Linux uses `policies.json` in the install's `distribution`
directory, or the ManagedStorage native manifest at
`/usr/lib/mozilla/managed-storage/{2c14f276-673b-4078-a575-8acf9d0579fa}.json` (also
read per-user from `~/.mozilla/managed-storage/`).

Note on packaging: the desktop app registers NM manifests only for
deb/rpm/tarball-installed browsers (per-user `~/.config/<vendor>`
dirs and `~/.mozilla/native-messaging-hosts`). Snap- and
flatpak-packaged browsers are sandboxed away from user-level NM hosts
and are not supported for verified pairing — those installs fall back
to the pairing-code gesture (or are refused when
`backend.requireNmIdentity` is locked on).

## Firefox (both platforms)

Two delivery mechanisms:

- **ManagedStorage native manifest** (live-verified): the JSON document
  above. macOS: the `Mozilla/ManagedStorage` directory; Windows: the
  registry pointer.
- **`policies.json`** (`firefox/policies.json`): the standard fleet
  path — carries force-install (`ExtensionSettings`) and the same four
  keys via `3rdparty.Extensions`. Place it in the `distribution`
  directory of the Firefox install, or deploy via GPO/ADMX. The
  `install_url` needs the AMO listing (placeholder until published).

## Verifying delivery

- The extension's Settings → Backend rows render a **MANAGED** badge
  and refuse edits for every policy-delivered key. This is the
  authoritative check.
- `chrome://policy` renders extension-scope policies under the
  extension's id after "Reload policies".
- `edge://policy` does **not** render extension-scope policies —
  Edge's policy page is blind to them even when they are applied; use
  the MANAGED badges (or the profile's
  `Managed Extension Settings/<id>` leveldb) instead.
- Firefox: `about:debugging` → the extension → inspect →
  `await browser.storage.managed.get(null)` shows the delivered keys.
