//! OpenHeaders-Installer — the file a person downloads to install
//! OpenHeaders on Windows. It reads the channel's Windows package
//! pointer, downloads the package with a percentage, holds it to the
//! pointer's hash and to our signer, and hands the file to Windows to
//! install for this user; then it opens the app. No elevation, nothing
//! left behind but its log.
//!
//! What it decides is in the modules beside this one and runs anywhere;
//! what it asks of Windows is in `win`.

#![cfg_attr(windows, windows_subsystem = "windows")]
#![cfg_attr(not(windows), allow(dead_code))]

mod args;
mod cleanup;
mod feed;
mod file_uri;
mod flow;
mod log;
mod outcome;
mod pointer;
mod transfer;
mod view;
#[cfg(windows)]
mod win;

/// The release this installer was built for (`build.rs`).
pub const RELEASE_VERSION: &str = env!("OPENHEADERS_RELEASE_VERSION");

#[cfg(windows)]
fn main() {
    std::process::exit(win::run());
}

#[cfg(not(windows))]
fn main() {
    eprintln!("OpenHeaders-Installer {RELEASE_VERSION} installs on Windows only");
    std::process::exit(outcome::Failure::Unexpected.exit_code());
}
