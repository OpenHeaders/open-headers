//! Who signed a file, as Windows judges it: the signature must verify
//! and chain to a root this PC trusts before its signer is read.

use core::ffi::c_void;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;

use windows::Win32::Foundation::{HWND, TRUST_E_NOSIGNATURE};
use windows::Win32::Security::Cryptography::{
    CERT_NAME_STR_REVERSE_FLAG, CERT_STRING_TYPE, CERT_X500_NAME_STR, CertNameToStrW, X509_ASN_ENCODING,
};
use windows::Win32::Security::WinTrust::{
    WINTRUST_ACTION_GENERIC_VERIFY_V2, WINTRUST_DATA, WINTRUST_DATA_0, WINTRUST_FILE_INFO,
    WTD_CACHE_ONLY_URL_RETRIEVAL, WTD_CHOICE_FILE, WTD_REVOKE_NONE, WTD_STATEACTION_CLOSE, WTD_STATEACTION_VERIFY,
    WTD_UI_NONE, WTHelperGetProvCertFromChain, WTHelperGetProvSignerFromChain, WTHelperProvDataFromStateData,
    WinVerifyTrust,
};
use windows::core::PCWSTR;

use crate::flow::Signer;

/// The subject of the verified signature's signing certificate.
unsafe fn signer_from_state(data: &WINTRUST_DATA) -> Result<Signer, String> {
    unsafe {
        let provider = WTHelperProvDataFromStateData(data.hWVTStateData);
        if provider.is_null() {
            return Err("Windows kept no record of the verification".to_string());
        }
        let signer = WTHelperGetProvSignerFromChain(provider, 0, false, 0);
        if signer.is_null() {
            return Err("the signature names no signer".to_string());
        }
        let certificate = WTHelperGetProvCertFromChain(signer, 0);
        if certificate.is_null() || (*certificate).pCert.is_null() || (*(*certificate).pCert).pCertInfo.is_null() {
            return Err("the signer carries no certificate".to_string());
        }
        let subject = &(*(*(*certificate).pCert).pCertInfo).Subject;
        let subject_der = std::slice::from_raw_parts(subject.pbData, subject.cbData as usize).to_vec();
        // The form Windows shows a publisher in: the common name first.
        let form = CERT_STRING_TYPE(CERT_X500_NAME_STR.0 | CERT_NAME_STR_REVERSE_FLAG);
        let length = CertNameToStrW(X509_ASN_ENCODING, subject, form, None);
        let mut text = vec![0u16; length as usize];
        let written = CertNameToStrW(X509_ASN_ENCODING, subject, form, Some(&mut text));
        let subject = String::from_utf16_lossy(&text[..(written as usize).saturating_sub(1)]);
        Ok(Signer { subject, subject_der })
    }
}

/// The signer of `file`, or `None` when the file carries no signature.
/// A signature that is there and does not verify is an error.
pub fn signer_of(file: &Path) -> Result<Option<Signer>, String> {
    let path: Vec<u16> = file.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let mut file_info = WINTRUST_FILE_INFO {
        cbStruct: size_of::<WINTRUST_FILE_INFO>() as u32,
        pcwszFilePath: PCWSTR(path.as_ptr()),
        ..Default::default()
    };
    let mut data = WINTRUST_DATA {
        cbStruct: size_of::<WINTRUST_DATA>() as u32,
        dwUIChoice: WTD_UI_NONE,
        fdwRevocationChecks: WTD_REVOKE_NONE,
        dwUnionChoice: WTD_CHOICE_FILE,
        Anonymous: WINTRUST_DATA_0 {
            pFile: &raw mut file_info,
        },
        dwStateAction: WTD_STATEACTION_VERIFY,
        dwProvFlags: WTD_CACHE_ONLY_URL_RETRIEVAL,
        ..Default::default()
    };
    let mut action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
    let status = unsafe { WinVerifyTrust(HWND::default(), &raw mut action, (&raw mut data).cast::<c_void>()) };
    let result = match status {
        0 => unsafe { signer_from_state(&data) }.map(Some),
        status if status == TRUST_E_NOSIGNATURE.0 => Ok(None),
        status => Err(format!(
            "Windows does not trust the signature (0x{:08X})",
            status as u32
        )),
    };
    data.dwStateAction = WTD_STATEACTION_CLOSE;
    unsafe { WinVerifyTrust(HWND::default(), &raw mut action, (&raw mut data).cast::<c_void>()) };
    result
}
