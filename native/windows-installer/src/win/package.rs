//! The package, through Windows' package manager: is it installed for
//! this user, install it from a file, open its app, take it away again —
//! and its app started through its alias, for a move.

use std::path::{Path, PathBuf};
use std::sync::mpsc;

use windows::ApplicationModel::Package;
use windows::Foundation::Uri;
use windows::Management::Deployment::{AddPackageOptions, DeploymentProgress, DeploymentResult, PackageManager};
use windows::Win32::System::Com::{CLSCTX_LOCAL_SERVER, CoAllowSetForegroundWindow, CoCreateInstance};
use windows::Win32::UI::Shell::{AO_NONE, ApplicationActivationManager, IApplicationActivationManager};
use windows::core::{HSTRING, PCWSTR};
use windows_future::{
    AsyncOperationProgressHandler, AsyncOperationWithProgressCompletedHandler, AsyncStatus, IAsyncOperationWithProgress,
};

use super::process;
use crate::classic_move::{CHECK_PACKAGE_START_SWITCH, FINISH_MOVE_SWITCH, package_app_alias};
use crate::file_uri::file_uri;
use crate::pointer::PACKAGE_IDENTITY_NAME;

fn said(error: windows::core::Error) -> String {
    format!("0x{:08X} {}", error.code().0 as u32, error.message())
}

/// This user's installed package of ours, if there is one. An empty
/// user id is the current user, which needs no elevation.
fn installed() -> windows::core::Result<Option<Package>> {
    let packages = PackageManager::new()?.FindPackagesByUserSecurityId(&HSTRING::new())?;
    for package in packages {
        if package.Id()?.Name()? == PACKAGE_IDENTITY_NAME {
            return Ok(Some(package));
        }
    }
    Ok(None)
}

pub fn installed_version() -> Result<Option<String>, String> {
    let Some(package) = installed().map_err(said)? else {
        return Ok(None);
    };
    let version = package.Id().and_then(|id| id.Version()).map_err(said)?;
    Ok(Some(format!(
        "{}.{}.{}.{}",
        version.Major, version.Minor, version.Build, version.Revision
    )))
}

enum Heard {
    Percent(u32),
    Ended(AsyncStatus),
}

/// Asks Windows to install the package file for this user and waits for
/// it, passing on the percentages Windows reports on the way.
pub fn install(file: &Path, on_percent: &mut dyn FnMut(u32)) -> Result<(), String> {
    let path = file
        .to_str()
        .ok_or_else(|| format!("{} is not a path Windows can be handed", file.display()))?;
    let uri = Uri::CreateUri(&HSTRING::from(file_uri(path))).map_err(said)?;
    let operation = PackageManager::new()
        .and_then(|manager| manager.AddPackageByUriAsync(&uri, &AddPackageOptions::new()?))
        .map_err(said)?;
    ended(&operation, on_percent)
}

/// Asks Windows to take this user's package away again and waits for it.
/// Windows closes what runs of the package. No package is no error.
pub fn remove() -> Result<(), String> {
    let Some(package) = installed().map_err(said)? else {
        return Ok(());
    };
    let full_name = package.Id().and_then(|id| id.FullName()).map_err(said)?;
    let operation = PackageManager::new()
        .and_then(|manager| manager.RemovePackageAsync(&full_name))
        .map_err(said)?;
    ended(&operation, &mut |_| {})
}

/// Waits for an operation of the package manager, passing on the
/// percentages Windows reports on the way; a refusal in Windows' own words.
fn ended(
    operation: &IAsyncOperationWithProgress<DeploymentResult, DeploymentProgress>,
    on_percent: &mut dyn FnMut(u32),
) -> Result<(), String> {
    let (heard, hears) = mpsc::channel();
    let progress = heard.clone();
    operation
        .SetProgress(
            &AsyncOperationProgressHandler::<DeploymentResult, DeploymentProgress>::new(move |_, reported| {
                let _ = progress.send(Heard::Percent(reported.percentage));
                Ok(())
            }),
        )
        .map_err(said)?;
    operation
        .SetCompleted(&AsyncOperationWithProgressCompletedHandler::<
            DeploymentResult,
            DeploymentProgress,
        >::new(move |_, status| {
            let _ = heard.send(Heard::Ended(status));
            Ok(())
        }))
        .map_err(said)?;
    let status = loop {
        match hears.recv() {
            Ok(Heard::Percent(percent)) => on_percent(percent),
            Ok(Heard::Ended(status)) => break status,
            Err(_) => return Err("Windows dropped the operation without an answer".to_string()),
        }
    };
    if status == AsyncStatus::Completed {
        return Ok(());
    }

    // The operation's code, and the result's text.
    let code = operation.ErrorCode().map(|code| code.0 as u32).unwrap_or(0);
    let text = operation
        .GetResults()
        .and_then(|result| result.ErrorText())
        .map(|text| text.to_string())
        .unwrap_or_default();
    Err(format!("0x{code:08X} {}", text.trim()).trim().to_string())
}

/// Opens the installed app as its Start menu entry does.
pub fn open_app() -> Result<(), String> {
    let package = installed()
        .map_err(said)?
        .ok_or("Windows lists no installed package to open")?;
    let entry = package
        .GetAppListEntries()
        .and_then(|entries| entries.GetAt(0))
        .map_err(said)?;
    let app_id = entry.AppUserModelId().map_err(said)?;
    unsafe {
        let activation: IApplicationActivationManager =
            CoCreateInstance(&ApplicationActivationManager, None, CLSCTX_LOCAL_SERVER).map_err(said)?;
        let _ = CoAllowSetForegroundWindow(&activation, None);
        activation
            .ActivateApplication(&app_id, PCWSTR::null(), AO_NONE)
            .map_err(said)?;
    }
    Ok(())
}

/// The package's app as a program outside the package starts it.
fn app_alias() -> Result<PathBuf, String> {
    std::env::var_os("LOCALAPPDATA")
        .map(|local| package_app_alias(Path::new(&local)))
        .ok_or_else(|| "this user has no LOCALAPPDATA".to_string())
}

/// Starts the installed app in its check mode and waits this long for it:
/// how the check ended. A check that outstays the wait is left to itself —
/// it ends by its own limit, and with the package when that is removed.
pub fn check_start(within_ms: u64) -> Result<i32, String> {
    let alias = app_alias()?;
    let mut check = process::apart(&alias)
        .arg(CHECK_PACKAGE_START_SWITCH)
        .spawn()
        .map_err(|error| format!("cannot start {}: {error}", alias.display()))?;
    if !process::ended_within(&check, within_ms) {
        return Err(format!("it did not end in {} s", within_ms / 1000));
    }
    check
        .wait()
        .map_err(|error| error.to_string())?
        .code()
        .ok_or_else(|| "it ended without a code".to_string())
}

/// Starts the installed app to take the classic install's data in; it
/// carries on as the app.
pub fn finish_move() -> Result<(), String> {
    let alias = app_alias()?;
    process::apart(&alias)
        .arg(FINISH_MOVE_SWITCH)
        .spawn()
        .map(drop)
        .map_err(|error| format!("cannot start {}: {error}", alias.display()))
}
