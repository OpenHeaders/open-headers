//! The Windows package pointer, as the installer reads it. The release
//! workflow writes one per channel (`scripts/generate-update-feed.mjs`):
//! the release, the signer's subject, and each arch's link with its size
//! and hash, and `stop`, which holds a release back — from an installed
//! app as an update, from here as a first install. Fields the installer
//! does not read are passed by — the pointer is a wire contract, and an
//! older installer reads newer ones.

use serde_json::Value;

/// The package's identity name, as its manifest declares it
/// (`apps/desktop/build/windows/AppxManifest.xml`): how the installer
/// asks Windows whether the package is installed.
pub const PACKAGE_IDENTITY_NAME: &str = "OpenHeaders";

/// The arch of a PC, by the name the pointer keys its packages with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Arch {
    X64,
    Arm64,
}

impl Arch {
    pub fn name(self) -> &'static str {
        match self {
            Arch::X64 => "x64",
            Arch::Arm64 => "arm64",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageOffer {
    /// The release the package belongs to, as its tag names it.
    pub version: String,
    /// The subject of the certificate the release's packages were signed with.
    pub publisher: String,
    pub url: String,
    pub size: u64,
    /// Lowercase hex.
    pub sha256: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum PointerError {
    /// Not a pointer the installer can act on.
    Unreadable(String),
    /// A pointer that names no package for this arch.
    NoPackage,
    /// A pointer whose `stop` is set: the release is held back, and a
    /// package the app is not offered as an update is not installed anew.
    Stopped,
}

fn text<'a>(object: &'a Value, key: &str) -> Result<&'a str, PointerError> {
    match object.get(key).and_then(Value::as_str) {
        Some(value) if !value.is_empty() => Ok(value),
        _ => Err(PointerError::Unreadable(format!("'{key}' is not a text value"))),
    }
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// The package a pointer offers a PC of `arch`.
pub fn read_offer(body: &[u8], arch: Arch) -> Result<PackageOffer, PointerError> {
    let pointer: Value =
        serde_json::from_slice(body).map_err(|error| PointerError::Unreadable(format!("not JSON: {error}")))?;
    if !pointer.is_object() {
        return Err(PointerError::Unreadable("not an object".to_string()));
    }
    let version = text(&pointer, "version")?;
    let publisher = text(&pointer, "publisher")?;
    match pointer.get("stop").and_then(Value::as_bool) {
        Some(false) => {}
        Some(true) => return Err(PointerError::Stopped),
        None => return Err(PointerError::Unreadable("'stop' is not true or false".to_string())),
    }
    let packages = pointer
        .get("packages")
        .filter(|packages| packages.is_object())
        .ok_or_else(|| PointerError::Unreadable("'packages' is not an object".to_string()))?;
    let package = match packages.get(arch.name()) {
        None | Some(Value::Null) => return Err(PointerError::NoPackage),
        Some(package) if package.is_object() => package,
        Some(_) => {
            return Err(PointerError::Unreadable(format!(
                "the {} package is not an object",
                arch.name()
            )));
        }
    };
    let url = text(package, "url")?;
    if !url.starts_with("https://") {
        return Err(PointerError::Unreadable(format!(
            "the {} package's link is not https",
            arch.name()
        )));
    }
    let size = package
        .get("size")
        .and_then(Value::as_u64)
        .filter(|size| *size > 0)
        .ok_or_else(|| PointerError::Unreadable("'size' is not a byte count".to_string()))?;
    let sha256 = text(package, "sha256")?.to_ascii_lowercase();
    if !is_sha256_hex(&sha256) {
        return Err(PointerError::Unreadable("'sha256' is not a SHA-256 in hex".to_string()));
    }
    Ok(PackageOffer {
        version: version.to_string(),
        publisher: publisher.to_string(),
        url: url.to_string(),
        size,
        sha256,
    })
}

/// The last path segment of a link: the name the download is kept under.
pub fn file_name_of(url: &str) -> Option<&str> {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    let name = path.rsplit('/').next()?;
    let plain = !name.is_empty()
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
        && !name.starts_with('.');
    plain.then_some(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_identity_name_is_the_manifests() {
        let manifest =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../apps/desktop/build/windows/AppxManifest.xml");
        let manifest = std::fs::read_to_string(manifest).unwrap();
        let identity = manifest
            .split("<Identity")
            .nth(1)
            .and_then(|rest| rest.split("/>").next())
            .unwrap();
        assert!(
            identity.contains(&format!("Name=\"{PACKAGE_IDENTITY_NAME}\"")),
            "{identity}"
        );
    }

    /// A pointer in the shape the release workflow stages one.
    const LIVE_SHAPE: &str = r#"{
      "version": "2026.11.3-beta.5",
      "packageVersion": "2026.11.3.5",
      "tag": "v2026.11.3-beta.5",
      "publisher": "CN=BITHUB TEAM SRL, O=BITHUB TEAM SRL, L=Iasi, S=Iasi, C=RO",
      "packages": {
        "x64": {
          "url": "https://updates.openheaders.io/dl/v2026.11.3-beta.5/OpenHeaders-2026.11.3-beta.5-x64.msix",
          "size": 255708023,
          "sha256": "0f3a6c1d2b4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e"
        },
        "arm64": {
          "url": "https://updates.openheaders.io/dl/v2026.11.3-beta.5/OpenHeaders-2026.11.3-beta.5-arm64.msix",
          "size": 252212268,
          "sha256": "A1B2C3D4E5F60718293A4B5C6D7E8F9A0B1C2D3E4F5061728394A5B6C7D8E9F0"
        }
      },
      "stop": false,
      "ramp": 100
    }"#;

    #[test]
    fn a_pc_gets_the_package_of_its_own_arch() {
        let offer = read_offer(LIVE_SHAPE.as_bytes(), Arch::Arm64).unwrap();
        assert_eq!(offer.version, "2026.11.3-beta.5");
        assert_eq!(
            offer.publisher,
            "CN=BITHUB TEAM SRL, O=BITHUB TEAM SRL, L=Iasi, S=Iasi, C=RO"
        );
        assert_eq!(
            offer.url,
            "https://updates.openheaders.io/dl/v2026.11.3-beta.5/OpenHeaders-2026.11.3-beta.5-arm64.msix"
        );
        assert_eq!(offer.size, 252_212_268);
        assert_eq!(
            offer.sha256,
            "a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e9f0"
        );
        assert_eq!(read_offer(LIVE_SHAPE.as_bytes(), Arch::X64).unwrap().size, 255_708_023);
    }

    #[test]
    fn a_pointer_without_this_arch_offers_nothing() {
        let body = LIVE_SHAPE.replace("\"arm64\"", "\"riscv\"");
        assert_eq!(read_offer(body.as_bytes(), Arch::Arm64), Err(PointerError::NoPackage));
    }

    #[test]
    fn a_pointer_that_says_stop_offers_nothing_to_any_arch() {
        let body = LIVE_SHAPE.replace("\"stop\": false", "\"stop\": true");
        for arch in [Arch::X64, Arch::Arm64] {
            assert_eq!(read_offer(body.as_bytes(), arch), Err(PointerError::Stopped));
        }
    }

    #[test]
    fn a_stop_that_is_not_true_or_false_is_unreadable() {
        for stop in ["\"stop\": \"no\"", "\"stop\": 0", "\"halt\": false"] {
            let body = LIVE_SHAPE.replace("\"stop\": false", stop);
            assert!(
                matches!(read_offer(body.as_bytes(), Arch::X64), Err(PointerError::Unreadable(_))),
                "{stop}"
            );
        }
    }

    #[test]
    fn an_empty_pointer_is_unreadable() {
        for body in ["{}", "[]", "not json", ""] {
            assert!(
                matches!(read_offer(body.as_bytes(), Arch::X64), Err(PointerError::Unreadable(_))),
                "{body}"
            );
        }
    }

    #[test]
    fn a_link_that_is_not_https_is_refused() {
        let body = LIVE_SHAPE.replace("https://updates", "http://updates");
        assert!(matches!(
            read_offer(body.as_bytes(), Arch::X64),
            Err(PointerError::Unreadable(_))
        ));
    }

    #[test]
    fn a_package_without_a_size_or_a_hash_is_refused() {
        let no_size = LIVE_SHAPE.replace("255708023", "0");
        assert!(matches!(
            read_offer(no_size.as_bytes(), Arch::X64),
            Err(PointerError::Unreadable(_))
        ));
        let short_hash = LIVE_SHAPE.replace("0f3a6c1d", "0f3a");
        assert!(matches!(
            read_offer(short_hash.as_bytes(), Arch::X64),
            Err(PointerError::Unreadable(_))
        ));
    }

    #[test]
    fn the_download_keeps_the_links_file_name() {
        assert_eq!(
            file_name_of("https://updates.openheaders.io/dl/v2026.11.3-beta.5/OpenHeaders-2026.11.3-beta.5-x64.msix"),
            Some("OpenHeaders-2026.11.3-beta.5-x64.msix")
        );
        assert_eq!(
            file_name_of("https://updates.openheaders.io/dl/a.msix?x=1"),
            Some("a.msix")
        );
        assert_eq!(file_name_of("https://updates.openheaders.io/dl/"), None);
        assert_eq!(file_name_of("https://updates.openheaders.io/dl/..%5Cevil.msix"), None);
    }
}
