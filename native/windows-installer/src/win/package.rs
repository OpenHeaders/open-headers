//! The package, through Windows' package manager: is it installed for
//! this user, install it from a file, open its app.

use std::path::Path;
use std::sync::mpsc;

use windows::ApplicationModel::Package;
use windows::Foundation::Uri;
use windows::Management::Deployment::{AddPackageOptions, DeploymentProgress, DeploymentResult, PackageManager};
use windows::Win32::System::Com::{CLSCTX_LOCAL_SERVER, CoAllowSetForegroundWindow, CoCreateInstance};
use windows::Win32::UI::Shell::{AO_NONE, ApplicationActivationManager, IApplicationActivationManager};
use windows::core::{HSTRING, PCWSTR};
use windows_future::{AsyncOperationProgressHandler, AsyncOperationWithProgressCompletedHandler, AsyncStatus};

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
            Err(_) => return Err("Windows dropped the install without an answer".to_string()),
        }
    };
    if status == AsyncStatus::Completed {
        return Ok(());
    }

    // Windows' own words for a refusal: the operation's code, and the result's text.
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
