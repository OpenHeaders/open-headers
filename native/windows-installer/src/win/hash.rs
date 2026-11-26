//! A file's SHA-256, computed by Windows.

use std::fs::File;
use std::io::Read;
use std::path::Path;

use windows::Win32::Security::Cryptography::{
    BCRYPT_ALG_HANDLE, BCRYPT_HASH_HANDLE, BCRYPT_OPEN_ALGORITHM_PROVIDER_FLAGS, BCRYPT_SHA256_ALGORITHM,
    BCryptCloseAlgorithmProvider, BCryptCreateHash, BCryptDestroyHash, BCryptFinishHash, BCryptHashData,
    BCryptOpenAlgorithmProvider,
};
use windows::core::PCWSTR;

fn digest(file: &Path, hash: BCRYPT_HASH_HANDLE) -> Result<[u8; 32], String> {
    let mut source = File::open(file).map_err(|error| format!("cannot open {}: {error}", file.display()))?;
    let mut piece = vec![0u8; 1 << 20];
    loop {
        let read = source
            .read(&mut piece)
            .map_err(|error| format!("cannot read {}: {error}", file.display()))?;
        if read == 0 {
            break;
        }
        unsafe { BCryptHashData(hash, &piece[..read], 0) }
            .ok()
            .map_err(|error| error.message())?;
    }
    let mut digest = [0u8; 32];
    unsafe { BCryptFinishHash(hash, &mut digest, 0) }
        .ok()
        .map_err(|error| error.message())?;
    Ok(digest)
}

/// Lowercase hex.
pub fn sha256_hex(file: &Path) -> Result<String, String> {
    let mut algorithm = BCRYPT_ALG_HANDLE::default();
    unsafe {
        BCryptOpenAlgorithmProvider(
            &raw mut algorithm,
            BCRYPT_SHA256_ALGORITHM,
            PCWSTR::null(),
            BCRYPT_OPEN_ALGORITHM_PROVIDER_FLAGS(0),
        )
    }
    .ok()
    .map_err(|error| error.message())?;
    let mut hash = BCRYPT_HASH_HANDLE::default();
    let created = unsafe { BCryptCreateHash(algorithm, &raw mut hash, None, None, 0) }.ok();
    let result = match created {
        Ok(()) => {
            let result = digest(file, hash);
            let _ = unsafe { BCryptDestroyHash(hash) };
            result
        }
        Err(error) => Err(error.message()),
    };
    let _ = unsafe { BCryptCloseAlgorithmProvider(algorithm, 0) };
    result.map(|digest| digest.iter().map(|byte| format!("{byte:02x}")).collect())
}
