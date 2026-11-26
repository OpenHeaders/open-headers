//! A Windows path as the `file:` link Windows' package manager takes.

/// `C:\Users\John Doe\a.msix` → `file:///C:/Users/John%20Doe/a.msix`;
/// `\\server\share\a.msix` → `file://server/share/a.msix`.
pub fn file_uri(path: &str) -> String {
    let forward = path.replace('\\', "/");
    let (prefix, rest) = match forward.strip_prefix("//") {
        Some(unc) => ("file://", unc),
        None => ("file:///", forward.as_str()),
    };
    let mut uri = String::from(prefix);
    for byte in rest.bytes() {
        let plain = byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~' | b'/' | b':');
        if plain {
            uri.push(byte as char);
        } else {
            uri.push_str(&format!("%{byte:02X}"));
        }
    }
    uri
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_drive_path_becomes_a_local_link() {
        assert_eq!(
            file_uri(
                "C:\\Users\\johndoe\\AppData\\Local\\Temp\\OpenHeaders-Installer\\OpenHeaders-2026.11.3-beta.6-x64.msix"
            ),
            "file:///C:/Users/johndoe/AppData/Local/Temp/OpenHeaders-Installer/OpenHeaders-2026.11.3-beta.6-x64.msix"
        );
    }

    #[test]
    fn a_name_with_a_space_or_a_letter_outside_ascii_is_escaped() {
        assert_eq!(
            file_uri("C:\\Users\\John Doe\\a.msix"),
            "file:///C:/Users/John%20Doe/a.msix"
        );
        assert_eq!(
            file_uri("C:\\Users\\Jöhn\\a#1.msix"),
            "file:///C:/Users/J%C3%B6hn/a%231.msix"
        );
    }

    #[test]
    fn a_network_path_keeps_its_server() {
        assert_eq!(file_uri("\\\\server\\share\\a.msix"), "file://server/share/a.msix");
    }
}
