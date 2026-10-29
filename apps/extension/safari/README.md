# OpenHeaders for Safari

The macOS app that carries the Safari build of the extension to the Mac App
Store. Safari installs web extensions only from inside a signed containing
app, so this folder holds that app: one window that shows whether the
extension is enabled in Safari and whether the Open Headers desktop app is
running on this computer, plus the extension's native endpoint, which the
product never calls.

## Layout

- `OpenHeaders for Safari.xcodeproj` — the Xcode project, two targets: the
  app and the Safari web extension. The extension target's resources are
  references into `../dist/safari`, the output of `pnpm run build:safari`,
  so the project never copies the extension and a rebuild is picked up as is.
- `App/` — the app: the window (`ViewController.swift`, `Resources/`), the
  icon set, the privacy manifest.
- `Extension/` — the `SafariWebExtensionHandler`, which answers nothing.
- `upload-ordinal.json` — the last build-number ordinal uploaded for the
  current version. Committed with every release.

## Versions

Both numbers derive from the extension's package version and are written
by `pnpm run version:safari`, never typed into Xcode:

- `MARKETING_VERSION` — the package CalVer verbatim (`2026.10.3`).
- `CURRENT_PROJECT_VERSION` — `YYYYMMPP.N`: the CalVer with the month and
  patch zero-padded, then the upload ordinal (`20261003.1`). App Store
  Connect refuses a build number it has seen, and a rejected or failed
  upload burns its number, so the ordinal only grows within a version.

## Release

```sh
pnpm run build:safari                     # the extension into dist/safari
APPLE_TEAM_ID=… ASC_KEY_PATH=… ASC_KEY_ID=… ASC_ISSUER_ID=… \
  pnpm run release:safari -- --skip-build # version, archive, export, upload
```

`--no-upload` exports a signed package under `archive/` instead of
uploading. The ordinal is bumped on every attempt either way; commit
`upload-ordinal.json` afterwards.

The API key needs the App Manager role, which uploads but cannot create
the Mac App Store provisioning profile. On a Mac that has never signed
this app, run the ritual once with `--xcode-account`: the ASC variables
are not read and the account signed in to Xcode provisions and uploads.
The Apple Distribution and Mac Installer Distribution certificates come
from Xcode › Settings › Accounts › Manage Certificates. The app's
category is Developer Tools, set in `App/Info.plist`.

The extension target's minimum Safari is 18.4 (`strict_min_version` in the
manifest); the app's minimum macOS is 15.4 (`MACOSX_DEPLOYMENT_TARGET`).
