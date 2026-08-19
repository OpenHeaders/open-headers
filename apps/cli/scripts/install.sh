#!/bin/sh
# Installs the standalone `oh` binary (and `ohd` with --with-daemon),
# verified against the release's SHA256SUMS.txt. Everything resolves
# through the update feed (updates.openheaders.com): the current release
# from `versions/stable.json`, the binaries from the feed's `dl/<tag>/`
# paths — one own-first-party domain, no GitHub reachability needed.
#
#   curl -fsSL https://updates.openheaders.com/install.sh | sh
#
# Options / environment:
#   --with-daemon      also install the ohd daemon binary
#   OH_INSTALL_DIR     install directory (default: ~/.local/bin)
#   OH_RELEASE_TAG     release tag to install (default: current stable)
set -eu

FEED="https://updates.openheaders.com"
INSTALL_DIR="${OH_INSTALL_DIR:-$HOME/.local/bin}"
TAG="${OH_RELEASE_TAG:-}"
WITH_DAEMON=0

for arg in "$@"; do
  case "$arg" in
    --with-daemon) WITH_DAEMON=1 ;;
    *)
      echo "install-oh: unknown option '$arg' (supported: --with-daemon)" >&2
      exit 2
      ;;
  esac
done

# ── Platform → published binary leg ───────────────────────────────────

OS=$(uname -s)
ARCH=$(uname -m)
case "${OS}/${ARCH}" in
  Darwin/arm64) OS_ARCH="mac-arm64" ;;
  Linux/x86_64) OS_ARCH="linux-x64" ;;
  Darwin/x86_64)
    echo "install-oh: no mac-x64 binary is published yet — use the Node channel instead:" >&2
    echo "  npm install -g @openheaders/cli" >&2
    exit 1
    ;;
  Linux/aarch64 | Linux/arm64)
    echo "install-oh: no linux-arm64 binary is published yet — use the Node channel instead:" >&2
    echo "  npm install -g @openheaders/cli" >&2
    exit 1
    ;;
  *)
    echo "install-oh: unsupported platform ${OS}/${ARCH}" >&2
    exit 1
    ;;
esac

# ── Tooling: downloader + checksum ────────────────────────────────────

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -qO "$2" "$1"; }
else
  echo "install-oh: needs curl or wget" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  checksum() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  checksum() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  echo "install-oh: needs sha256sum or shasum" >&2
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Resolve the release tag from the update feed ──────────────────────

if [ -z "$TAG" ]; then
  fetch "${FEED}/versions/stable.json" "${TMP_DIR}/versions.json"
  TAG=$(sed -n '/"cli": {/,/}/p' "${TMP_DIR}/versions.json" | sed -n 's/.*"tag": *"\([^"]*\)".*/\1/p' | head -1)
  if [ -z "$TAG" ]; then
    echo "install-oh: could not resolve the current release from ${FEED}/versions/stable.json" >&2
    exit 1
  fi
fi
BASE_URL="${FEED}/dl/${TAG}"

# ── Resolve assets from the release's checksum manifest ───────────────

fetch "${BASE_URL}/SHA256SUMS.txt" "${TMP_DIR}/SHA256SUMS.txt"

# install_binary <name>: look up `<name>-<version>-<os-arch>` in the
# manifest, download it, verify, and install as plain `<name>`.
install_binary() {
  name="$1"
  line=$(awk -v pat="^${name}-[0-9].*-${OS_ARCH}\$" '$2 ~ pat { print; exit }' "${TMP_DIR}/SHA256SUMS.txt")
  if [ -z "$line" ]; then
    echo "install-oh: release has no ${name} binary for ${OS_ARCH}" >&2
    exit 1
  fi
  expected=$(echo "$line" | awk '{print $1}')
  asset=$(echo "$line" | awk '{print $2}')

  echo "install-oh: downloading ${asset}"
  fetch "${BASE_URL}/${asset}" "${TMP_DIR}/${name}"

  actual=$(checksum "${TMP_DIR}/${name}")
  if [ "$actual" != "$expected" ]; then
    echo "install-oh: checksum mismatch for ${asset}" >&2
    echo "  expected ${expected}" >&2
    echo "  got      ${actual}" >&2
    exit 1
  fi

  chmod +x "${TMP_DIR}/${name}"
  mkdir -p "$INSTALL_DIR"
  mv "${TMP_DIR}/${name}" "${INSTALL_DIR}/${name}"
  echo "install-oh: installed ${INSTALL_DIR}/${name} (${asset})"
}

install_binary oh
if [ "$WITH_DAEMON" = "1" ]; then
  install_binary ohd
fi

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo ""
    echo "install-oh: ${INSTALL_DIR} is not on your PATH — add it to your shell profile:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
    ;;
esac

echo ""
"${INSTALL_DIR}/oh" --version
