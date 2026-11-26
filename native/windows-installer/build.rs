//! Two things the program carries from its build.
//!
//! The release it was built for. `Cargo.toml` holds the release's base
//! (`2026.11.3`), bumped with the apps' versions; a release build hands
//! over the whole version (`2026.11.3-beta.6`) in
//! `OPENHEADERS_INSTALLER_VERSION`, and a base that differs fails the
//! build — an installer of one release never ships under another's tag.
//! A build without the variable is the base itself.
//!
//! Its application manifest (`installer.manifest`), as a compiled
//! resource file the linker takes like any object — written here byte by
//! byte, so the build needs no resource compiler and is the same under
//! Microsoft's linker and under LLVM's.

use std::path::PathBuf;

/// Resource type of an application manifest, and the id Windows reads it under in a program.
const RT_MANIFEST: u16 = 24;
const PROGRAM_MANIFEST_ID: u16 = 1;
const LANGUAGE_EN_US: u16 = 0x0409;

/// One entry of a compiled resource file: a 32-byte header naming the
/// resource by numbers, then its bytes, padded to a multiple of four.
fn resource_entry(kind: u16, id: u16, language: u16, data: &[u8]) -> Vec<u8> {
    let mut entry = Vec::with_capacity(32 + data.len() + 3);
    entry.extend_from_slice(&(data.len() as u32).to_le_bytes());
    entry.extend_from_slice(&32u32.to_le_bytes());
    for number in [0xFFFF, kind, 0xFFFF, id] {
        entry.extend_from_slice(&number.to_le_bytes());
    }
    entry.extend_from_slice(&0u32.to_le_bytes()); // data version
    entry.extend_from_slice(&0u16.to_le_bytes()); // memory flags
    entry.extend_from_slice(&language.to_le_bytes());
    entry.extend_from_slice(&0u32.to_le_bytes()); // version
    entry.extend_from_slice(&0u32.to_le_bytes()); // characteristics
    entry.extend_from_slice(data);
    while entry.len() % 4 != 0 {
        entry.push(0);
    }
    entry
}

/// A compiled resource file holding the manifest alone. Such a file
/// opens with an empty entry that marks its format.
fn manifest_resource_file(manifest: &[u8]) -> Vec<u8> {
    let mut file = resource_entry(0, 0, 0, &[]);
    file.extend(resource_entry(
        RT_MANIFEST,
        PROGRAM_MANIFEST_ID,
        LANGUAGE_EN_US,
        manifest,
    ));
    file
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=installer.manifest");
    println!("cargo:rerun-if-env-changed=OPENHEADERS_INSTALLER_VERSION");

    let base = std::env::var("CARGO_PKG_VERSION").expect("cargo sets the package version");
    let release = match std::env::var("OPENHEADERS_INSTALLER_VERSION") {
        Ok(version) if !version.is_empty() => version,
        _ => base.clone(),
    };
    let release_base = release.split("-beta.").next().unwrap_or(&release);
    if release_base != base {
        panic!(
            "the installer is at {base} (Cargo.toml) and was asked to build for {release}: bump Cargo.toml with the apps' versions"
        );
    }
    println!("cargo:rustc-env=OPENHEADERS_RELEASE_VERSION={release}");

    if std::env::var_os("CARGO_CFG_WINDOWS").is_some() {
        let manifest = std::fs::read_to_string("installer.manifest")
            .expect("installer.manifest is read")
            .replace("${version}", &format!("{base}.0"));
        let out =
            PathBuf::from(std::env::var_os("OUT_DIR").expect("cargo sets the output folder")).join("manifest.res");
        std::fs::write(&out, manifest_resource_file(manifest.as_bytes())).expect("the manifest resource is written");
        // The manifest above is the program's only one: the linker adds none of its own.
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
        println!("cargo:rustc-link-arg-bins={}", out.display());
    }
}
