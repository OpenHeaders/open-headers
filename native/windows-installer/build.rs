//! Two things the program carries from its build.
//!
//! The release it was built for. `Cargo.toml` holds the release's base
//! (`2026.11.3`), bumped with the apps' versions; a release build hands
//! over the whole version (`2026.11.3-beta.6`) in
//! `OPENHEADERS_INSTALLER_VERSION`, and a base that differs fails the
//! build — an installer of one release never ships under another's tag.
//! A build without the variable is the base itself.
//!
//! Its resources (`resources.rs`): the application manifest
//! (`installer.manifest`), the app's icon — the desktop's own icon file,
//! read where it lives — and the version Windows shows for the file, as
//! a compiled resource file the linker takes like any object.

use std::path::{Path, PathBuf};

#[path = "resources.rs"]
mod resources;

/// The desktop's icon file, from this crate's folder.
const ICON_FILE: &str = "../../apps/desktop/build/icon.ico";

/// The arch in the published file's name (`scripts/build-windows-installer.mjs`).
fn published_arch(target_arch: &str) -> &str {
    match target_arch {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        other => other,
    }
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=resources.rs");
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
    let numbers = resources::release_numbers(&release).unwrap_or_else(|why| panic!("{why}"));
    println!("cargo:rustc-env=OPENHEADERS_RELEASE_VERSION={release}");

    if std::env::var_os("CARGO_CFG_WINDOWS").is_some() {
        let dotted = numbers.map(|number| number.to_string()).join(".");
        let manifest = std::fs::read_to_string("installer.manifest")
            .expect("installer.manifest is read")
            .replace("${version}", &dotted);
        let icon = std::fs::read(Path::new(ICON_FILE)).expect("the desktop's icon file is read");
        let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").expect("cargo names the target's arch");
        let version = resources::version_resource(
            numbers,
            &[
                ("CompanyName", "BITHUB TEAM SRL"),
                ("FileDescription", "Open Headers Installer"),
                ("FileVersion", &dotted),
                (
                    "OriginalFilename",
                    &format!("OpenHeaders-Installer-{}.exe", published_arch(&target_arch)),
                ),
                ("ProductName", "Open Headers"),
                ("ProductVersion", &release),
            ],
        );
        let out =
            PathBuf::from(std::env::var_os("OUT_DIR").expect("cargo sets the output folder")).join("resources.res");
        std::fs::write(&out, resources::resource_file(manifest.as_bytes(), &icon, &version))
            .expect("the resource file is written");
        // The manifest above is the program's only one: the linker adds none of its own.
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
        println!("cargo:rustc-link-arg-bins={}", out.display());
    }
}
