//! Two things the program carries from its build.
//!
//! The release it was built for. `Cargo.toml` holds the release's base
//! (`2026.11.3`), bumped with the apps' versions; a release build hands
//! over the whole version (`2026.11.3-beta.6`) in
//! `OPENHEADERS_INSTALLER_VERSION`, and a base that differs fails the
//! build — an installer of one release never ships under another's tag.
//! A build without the variable is the base itself.
//!
//! Its resources: the application manifest (`installer.manifest`) and
//! the app's icon — the desktop's own icon file, read where it lives —
//! as a compiled resource file the linker takes like any object. It is
//! written here byte by byte, so the build needs no resource compiler
//! and is the same under Microsoft's linker and under LLVM's.

use std::path::{Path, PathBuf};

/// Resource type of an application manifest, and the id Windows reads it under in a program.
const RT_MANIFEST: u16 = 24;
const PROGRAM_MANIFEST_ID: u16 = 1;
/// Resource types of one image of an icon, and of the list that names an icon's images.
const RT_ICON: u16 = 3;
const RT_GROUP_ICON: u16 = 14;
/// The id of the program's icon: Windows shows a program's first icon as the file's own, and the
/// window loads it by this number (`ICON_ID` in `src/win/window.rs`).
const PROGRAM_ICON_ID: u16 = 1;
const LANGUAGE_EN_US: u16 = 0x0409;

/// The desktop's icon file, from this crate's folder.
const ICON_FILE: &str = "../../apps/desktop/build/icon.ico";

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

/// An icon file as resource entries: each image under a number of its
/// own, then the list of them. An icon file opens with a six-byte header
/// (the image count last) and one sixteen-byte row per image, whose last
/// eight bytes are the image's size and its place in the file; the list
/// in a program keeps a row's first twelve bytes and names the image by
/// its number instead of its place.
fn icon_resource_entries(icon: &[u8]) -> Vec<u8> {
    let number = |at: usize, bytes: usize| -> usize {
        let field = icon.get(at..at + bytes).expect("the icon file is cut short");
        field
            .iter()
            .rev()
            .fold(0usize, |value, byte| (value << 8) | usize::from(*byte))
    };
    assert!(
        number(0, 2) == 0 && number(2, 2) == 1,
        "{ICON_FILE} is not an icon file"
    );
    let count = number(4, 2);
    assert!(count > 0, "{ICON_FILE} holds no image");

    let mut entries = Vec::new();
    let mut list = Vec::with_capacity(6 + count * 14);
    list.extend_from_slice(&icon[..6]);
    for index in 0..count {
        let row = 6 + index * 16;
        let (size, place) = (number(row + 8, 4), number(row + 12, 4));
        let image = icon
            .get(place..place + size)
            .expect("an icon image lies outside the file");
        let id = index as u16 + 1;
        entries.extend(resource_entry(RT_ICON, id, LANGUAGE_EN_US, image));
        list.extend_from_slice(&icon[row..row + 12]);
        list.extend_from_slice(&id.to_le_bytes());
    }
    entries.extend(resource_entry(RT_GROUP_ICON, PROGRAM_ICON_ID, LANGUAGE_EN_US, &list));
    entries
}

/// The compiled resource file: the manifest and the icon. Such a file
/// opens with an empty entry that marks its format.
fn resource_file(manifest: &[u8], icon: &[u8]) -> Vec<u8> {
    let mut file = resource_entry(0, 0, 0, &[]);
    file.extend(resource_entry(
        RT_MANIFEST,
        PROGRAM_MANIFEST_ID,
        LANGUAGE_EN_US,
        manifest,
    ));
    file.extend(icon_resource_entries(icon));
    file
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=installer.manifest");
    println!("cargo:rerun-if-changed={ICON_FILE}");
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
        let icon = std::fs::read(Path::new(ICON_FILE)).expect("the desktop's icon file is read");
        let out =
            PathBuf::from(std::env::var_os("OUT_DIR").expect("cargo sets the output folder")).join("resources.res");
        std::fs::write(&out, resource_file(manifest.as_bytes(), &icon)).expect("the resource file is written");
        // The manifest above is the program's only one: the linker adds none of its own.
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
        println!("cargo:rustc-link-arg-bins={}", out.display());
    }
}
