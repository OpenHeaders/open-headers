//! Whether this PC takes the package, and which arch it is.

use core::ffi::c_void;

use windows::Foundation::Metadata::ApiInformation;
use windows::System::Profile::WindowsIntegrityPolicy;
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::Win32::System::Registry::{HKEY_LOCAL_MACHINE, RRF_RT_REG_DWORD, RegGetValueW};
use windows::Win32::System::SystemInformation::{
    IMAGE_FILE_MACHINE, IMAGE_FILE_MACHINE_AMD64, IMAGE_FILE_MACHINE_ARM64,
};
use windows::Win32::System::Threading::{GetCurrentProcess, IsWow64Process2};
use windows::core::{HSTRING, w};

use crate::flow::Unfit;
use crate::pointer::Arch;

/// The contract version that brought the package manager's install by
/// link: Windows 10 2004. The app's own updater asks for the same one.
const INSTALL_BY_LINK_CONTRACT: u16 = 10;

/// The policy "Allow all trusted apps to install": 0 is an explicit no.
fn sideloading_denied() -> bool {
    let mut value = 0u32;
    let mut size = size_of::<u32>() as u32;
    let read = unsafe {
        RegGetValueW(
            HKEY_LOCAL_MACHINE,
            w!("SOFTWARE\\Policies\\Microsoft\\Windows\\Appx"),
            w!("AllowAllTrustedApps"),
            RRF_RT_REG_DWORD,
            None,
            Some((&raw mut value).cast::<c_void>()),
            Some(&raw mut size),
        )
    };
    read == ERROR_SUCCESS && value == 0
}

pub fn fitness() -> Result<(), Unfit> {
    let contract = HSTRING::from("Windows.Foundation.UniversalApiContract");
    if !ApiInformation::IsApiContractPresentByMajor(&contract, INSTALL_BY_LINK_CONTRACT).unwrap_or(false) {
        return Err(Unfit::WindowsTooOld);
    }
    if WindowsIntegrityPolicy::IsEnabled().unwrap_or(false) {
        return Err(Unfit::SMode);
    }
    if sideloading_denied() {
        return Err(Unfit::PolicyBlocks);
    }
    Ok(())
}

/// The PC's own arch: an x64 installer run on an ARM PC installs the ARM package.
pub fn arch() -> Option<Arch> {
    let mut process = IMAGE_FILE_MACHINE::default();
    let mut native = IMAGE_FILE_MACHINE::default();
    unsafe { IsWow64Process2(GetCurrentProcess(), &raw mut process, Some(&raw mut native)) }.ok()?;
    match native {
        IMAGE_FILE_MACHINE_ARM64 => Some(Arch::Arm64),
        IMAGE_FILE_MACHINE_AMD64 => Some(Arch::X64),
        _ => None,
    }
}
