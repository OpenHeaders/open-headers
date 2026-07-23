const { execFileSync } = require('child_process');

// afterSign (notarize.js) covers only the .app — the pkg/dmg containers
// are assembled afterwards, and Gatekeeper assesses a downloaded
// installer on its own notarization, not the payload's. This hook
// notarizes and staples every mac .pkg and .dmg once all artifacts
// exist, so first launch passes fully offline. An unsigned pkg (no
// Developer ID Installer identity in the keychain) is skipped with a
// warning instead of failing the leg — same degrade contract as the
// Windows signing steps. Stapling changes dmg bytes after latest-mac.yml
// is computed; harmless — the mac update feed downloads the zip, never
// the dmg.
async function notarizeArtifacts(buildResult) {
    if (process.platform !== 'darwin') return [];

    const containers = (buildResult.artifactPaths || []).filter((p) => p.endsWith('.pkg') || p.endsWith('.dmg'));
    if (containers.length === 0) return [];

    if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
        console.log('⏭️ Skipping pkg/dmg notarization for unsigned build (CSC_IDENTITY_AUTO_DISCOVERY=false)');
        return [];
    }

    const missingVars = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'].filter(
        (key) => !process.env[key]
    );
    if (missingVars.length > 0) {
        console.log(`⚠️ Skipping pkg/dmg notarization: Missing required environment variables: ${missingVars.join(', ')}`);
        return [];
    }

    for (const artifactPath of containers) {
        if (artifactPath.endsWith('.pkg')) {
            let signed = true;
            try {
                const check = execFileSync('pkgutil', ['--check-signature', artifactPath], { encoding: 'utf8' });
                signed = !check.includes('no signature');
            } catch {
                signed = false;
            }
            if (!signed) {
                console.warn(
                    `⚠️ ${artifactPath} is unsigned (no Developer ID Installer identity?) — skipping notarization`
                );
                continue;
            }
        }

        console.log(`📝 Notarizing ${artifactPath}`);
        execFileSync(
            'xcrun',
            [
                'notarytool',
                'submit',
                artifactPath,
                '--apple-id',
                process.env.APPLE_ID,
                '--password',
                process.env.APPLE_APP_SPECIFIC_PASSWORD,
                '--team-id',
                process.env.APPLE_TEAM_ID,
                '--wait',
            ],
            { stdio: 'inherit' }
        );
        execFileSync('xcrun', ['stapler', 'staple', artifactPath], { stdio: 'inherit' });
        console.log(`✅ Notarized and stapled ${artifactPath}`);
    }
    return [];
}

module.exports = notarizeArtifacts;
