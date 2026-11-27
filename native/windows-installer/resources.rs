//! The program's resources, as a compiled resource file the linker takes
//! like any object: the application manifest, the app's icon, and the
//! version Windows shows for the file. It is written byte by byte, so the
//! build needs no resource compiler and is the same under Microsoft's
//! linker and under LLVM's. `build.rs` writes the file with these; the
//! crate's tests read them too.

/// Resource types: one image of an icon, the list that names an icon's
/// images, a file's version, an application manifest.
const RT_ICON: u16 = 3;
const RT_GROUP_ICON: u16 = 14;
const RT_VERSION: u16 = 16;
const RT_MANIFEST: u16 = 24;
/// The ids Windows reads a program's manifest and its version under.
const PROGRAM_MANIFEST_ID: u16 = 1;
const PROGRAM_VERSION_ID: u16 = 1;
/// The id of the program's icon: Windows shows a program's first icon as the file's own, and the
/// window loads it by this number (`ICON_ID` in `src/win/window.rs`).
const PROGRAM_ICON_ID: u16 = 1;
const LANGUAGE_EN_US: u16 = 0x0409;
/// The code page of a version resource's texts: two bytes a character.
const CODE_PAGE_UNICODE: u16 = 1200;

/// The fourth number of a stable's version; a beta N takes N, so N stays below it.
const STABLE_REVISION: u16 = 1000;

/// A release as the four numbers Windows keeps a version in — the rule
/// the Windows package's version follows (`packageVersion` in
/// `scripts/lib/versions.mjs`): beta N takes N, the stable 1000.
pub fn release_numbers(release: &str) -> Result<[u16; 4], String> {
    let (base, beta) = match release.split_once("-beta.") {
        Some((base, beta)) => (base, Some(beta)),
        None => (release, None),
    };
    let number = |text: &str| {
        text.parse::<u16>()
            .map_err(|_| format!("'{release}' is not a release version (YYYY.M.PATCH or YYYY.M.PATCH-beta.N)"))
    };
    let parts: Vec<&str> = base.split('.').collect();
    let [year, month, patch] = parts.as_slice() else {
        return Err(format!(
            "'{release}' is not a release version (YYYY.M.PATCH or YYYY.M.PATCH-beta.N)"
        ));
    };
    let revision = match beta {
        None => STABLE_REVISION,
        Some(beta) => match number(beta)? {
            beta @ 1..STABLE_REVISION => beta,
            _ => return Err(format!("'{release}': a beta is numbered 1 to {}", STABLE_REVISION - 1)),
        },
    };
    Ok([number(year)?, number(month)?, number(patch)?, revision])
}

fn pad_to_four(bytes: &mut Vec<u8>) {
    while !bytes.len().is_multiple_of(4) {
        bytes.push(0);
    }
}

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
    pad_to_four(&mut entry);
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
        "the program's icon is not an icon file"
    );
    let count = number(4, 2);
    assert!(count > 0, "the program's icon file holds no image");

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

/// A text as a version resource keeps one: two bytes a character, a zero at its end.
fn wide(text: &str) -> Vec<u8> {
    text.encode_utf16().chain([0]).flat_map(u16::to_le_bytes).collect()
}

/// One node of a version resource: its whole length, its value's length
/// and whether the value is text, its name, the value, its children —
/// the value and each child starting on a multiple of four bytes.
fn version_node(name: &str, text: bool, value_length: u16, value: &[u8], children: &[Vec<u8>]) -> Vec<u8> {
    let mut node = vec![0u8; 2];
    node.extend_from_slice(&value_length.to_le_bytes());
    node.extend_from_slice(&u16::from(text).to_le_bytes());
    node.extend(wide(name));
    pad_to_four(&mut node);
    node.extend_from_slice(value);
    for child in children {
        pad_to_four(&mut node);
        node.extend_from_slice(child);
    }
    let length = node.len() as u16;
    node[..2].copy_from_slice(&length.to_le_bytes());
    node
}

/// The version Windows shows for the file — on its Details page, in a
/// download's prompt, in the task list: the four numbers, and the texts
/// by their names (`FileDescription`, `ProductName`, …).
pub fn version_resource(numbers: [u16; 4], texts: &[(&str, &str)]) -> Vec<u8> {
    let [year, month, patch, revision] = numbers.map(u32::from);
    let (high, low) = ((year << 16) | month, (patch << 16) | revision);
    // The fixed part: its mark and layout, the file's and the product's version, which flags
    // are told (none is set), a 32-bit Windows program, an application, no subtype, no date.
    let fixed: Vec<u8> = [
        0xFEEF_04BDu32,
        0x0001_0000,
        high,
        low,
        high,
        low,
        0x3F,
        0,
        0x0004_0004,
        1,
        0,
        0,
        0,
    ]
    .iter()
    .flat_map(|field| field.to_le_bytes())
    .collect();

    let texts: Vec<Vec<u8>> = texts
        .iter()
        .map(|(name, value)| {
            let value = wide(value);
            // A text's length is counted in characters, its ending zero among them.
            version_node(name, true, (value.len() / 2) as u16, &value, &[])
        })
        .collect();
    let table = version_node(
        &format!("{LANGUAGE_EN_US:04X}{CODE_PAGE_UNICODE:04X}"),
        true,
        0,
        &[],
        &texts,
    );
    let translation: Vec<u8> = [LANGUAGE_EN_US, CODE_PAGE_UNICODE]
        .iter()
        .flat_map(|field| field.to_le_bytes())
        .collect();
    version_node(
        "VS_VERSION_INFO",
        false,
        fixed.len() as u16,
        &fixed,
        &[
            version_node("StringFileInfo", true, 0, &[], &[table]),
            version_node(
                "VarFileInfo",
                true,
                0,
                &[],
                &[version_node("Translation", false, 4, &translation, &[])],
            ),
        ],
    )
}

/// The compiled resource file: the manifest, the icon, the version. Such
/// a file opens with an empty entry that marks its format.
pub fn resource_file(manifest: &[u8], icon: &[u8], version: &[u8]) -> Vec<u8> {
    let mut file = resource_entry(0, 0, 0, &[]);
    file.extend(resource_entry(
        RT_MANIFEST,
        PROGRAM_MANIFEST_ID,
        LANGUAGE_EN_US,
        manifest,
    ));
    file.extend(icon_resource_entries(icon));
    file.extend(resource_entry(RT_VERSION, PROGRAM_VERSION_ID, LANGUAGE_EN_US, version));
    file
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_release_reads_as_its_packages_four_numbers() {
        // The examples `packageVersion` is pinned with (the desktop's package-version suite).
        for (release, numbers) in [
            ("2026.11.2-beta.7", [2026, 11, 2, 7]),
            ("2026.11.2", [2026, 11, 2, 1000]),
            ("2026.12.0-beta.1", [2026, 12, 0, 1]),
            ("2027.1.0", [2027, 1, 0, 1000]),
            ("2026.11.3-beta.999", [2026, 11, 3, 999]),
        ] {
            assert_eq!(release_numbers(release), Ok(numbers), "{release}");
        }
    }

    #[test]
    fn what_is_no_release_has_no_numbers() {
        for release in [
            "",
            "2026.11",
            "2026.11.2.1",
            "v2026.11.2",
            "2026.11.2-rc.1",
            "2026.11.2-beta",
            "2026.11.2-beta.0",
            "2026.11.2-beta.1000",
            "2026.11.65536",
        ] {
            assert!(release_numbers(release).is_err(), "{release}");
        }
    }

    fn word(bytes: &[u8], at: usize) -> usize {
        usize::from(u16::from_le_bytes([bytes[at], bytes[at + 1]]))
    }

    fn up_to_four(length: usize) -> usize {
        length.div_ceil(4) * 4
    }

    struct Node {
        name: String,
        text: bool,
        value: Vec<u8>,
        children: Vec<Node>,
    }

    impl Node {
        fn child(&self, name: &str) -> &Node {
            self.children
                .iter()
                .find(|child| child.name == name)
                .unwrap_or_else(|| panic!("{} holds no {name}", self.name))
        }

        fn words(&self) -> String {
            let units: Vec<u16> = self
                .value
                .chunks(2)
                .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
                .collect();
            assert_eq!(units.last(), Some(&0), "{} does not end in a zero", self.name);
            String::from_utf16(&units[..units.len() - 1]).unwrap()
        }
    }

    /// A node read back as Windows reads one: by the lengths it states.
    fn read_node(bytes: &[u8]) -> Node {
        assert_eq!(word(bytes, 0), bytes.len(), "a node states its own length");
        let text = word(bytes, 4) == 1;
        let mut name = Vec::new();
        let mut at = 6;
        while word(bytes, at) != 0 {
            name.push(word(bytes, at) as u16);
            at += 2;
        }
        let name = String::from_utf16(&name).unwrap();
        let value_from = up_to_four(at + 2);
        let value_to = value_from + word(bytes, 2) * if text { 2 } else { 1 };
        let mut children = Vec::new();
        let mut at = up_to_four(value_to);
        while at < bytes.len() {
            let length = word(bytes, at);
            children.push(read_node(&bytes[at..at + length]));
            at = up_to_four(at + length);
        }
        Node {
            name,
            text,
            value: bytes[value_from..value_to.min(bytes.len())].to_vec(),
            children,
        }
    }

    const TEXTS: [(&str, &str); 3] = [
        ("FileDescription", "Open Headers Installer"),
        ("ProductName", "Open Headers"),
        ("ProductVersion", "2026.11.3-beta.6"),
    ];

    #[test]
    fn the_version_reads_back_with_its_numbers_and_its_texts() {
        let version = read_node(&version_resource([2026, 11, 3, 6], &TEXTS));
        assert_eq!((version.name.as_str(), version.text), ("VS_VERSION_INFO", false));
        assert_eq!(version.value.len(), 52);
        assert_eq!(version.value[..4], [0xBD, 0x04, 0xEF, 0xFE]);
        // The file's version, then the product's: each as two pairs, the higher number second in its pair.
        for at in [8, 16] {
            let numbers = [at + 2, at, at + 6, at + 4].map(|at| word(&version.value, at));
            assert_eq!(numbers, [2026, 11, 3, 6]);
        }

        let table = version.child("StringFileInfo").child("040904B0");
        assert_eq!(table.children.len(), TEXTS.len());
        for (name, value) in TEXTS {
            let text = table.child(name);
            assert!(text.text);
            assert_eq!(text.words(), value);
        }
        let translation = version.child("VarFileInfo").child("Translation");
        assert_eq!(translation.value, [0x09, 0x04, 0xB0, 0x04]);
    }

    /// The smallest icon file there is: one image of four bytes.
    fn icon() -> Vec<u8> {
        let mut icon = vec![0, 0, 1, 0, 1, 0];
        icon.extend_from_slice(&[16, 16, 0, 0, 1, 0, 32, 0]);
        icon.extend_from_slice(&4u32.to_le_bytes());
        icon.extend_from_slice(&22u32.to_le_bytes());
        icon.extend_from_slice(&[1, 2, 3, 4]);
        icon
    }

    #[test]
    fn the_resource_file_holds_the_manifest_the_icon_and_the_version() {
        let version = version_resource([2026, 11, 3, 1000], &TEXTS);
        let file = resource_file(b"<assembly/>", &icon(), &version);
        let mut kinds = Vec::new();
        let mut at = 0;
        while at < file.len() {
            let size = u32::from_le_bytes([file[at], file[at + 1], file[at + 2], file[at + 3]]) as usize;
            assert_eq!(word(&file, at + 4), 32);
            let kind = word(&file, at + 10);
            if kind == usize::from(RT_VERSION) {
                assert_eq!(file[at + 32..at + 32 + size], version[..]);
            }
            kinds.push(kind as u16);
            at += up_to_four(32 + size);
        }
        assert_eq!(at, file.len());
        assert_eq!(kinds, [0, RT_MANIFEST, RT_ICON, RT_GROUP_ICON, RT_VERSION]);
    }
}
