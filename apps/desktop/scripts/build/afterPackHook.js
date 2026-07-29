const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Compiles the SMAppService trust helper (dual-mode Swift binary) and
// embeds it with its launchd plist. Runs before signing, so the helper
// is signed and sealed with the app. A missing Swift toolchain skips
// the helper — the daemon's capability probe then stays honestly off.
function embedMacTrustHelper(context) {
    const { appOutDir } = context;
    const helperSrcDir = path.join(__dirname, '..', '..', 'build', 'mac', 'trust-helper');
    const appName = context.packager.appInfo.productFilename;
    const contentsDir = path.join(appOutDir, `${appName}.app`, 'Contents');
    const sources = fs.readdirSync(helperSrcDir)
        .filter((f) => f.endsWith('.swift'))
        .sort()
        .map((f) => path.join(helperSrcDir, f));
    // electron-builder Arch enum: 1 = x64, 3 = arm64, 4 = universal
    const archNames = context.arch === 1 ? ['x86_64'] : context.arch === 3 ? ['arm64'] : ['arm64', 'x86_64'];
    const binaryPath = path.join(contentsDir, 'MacOS', 'oh-trust-helper');
    const slicePaths = [];
    try {
        for (const archName of archNames) {
            const slicePath = archNames.length === 1 ? binaryPath : `${binaryPath}-${archName}`;
            execFileSync('xcrun', [
                'swiftc', '-O',
                '-target', `${archName}-apple-macos13.0`,
                '-o', slicePath,
                ...sources
            ], { stdio: 'pipe' });
            slicePaths.push(slicePath);
        }
        if (slicePaths.length > 1) {
            execFileSync('lipo', ['-create', ...slicePaths, '-output', binaryPath], { stdio: 'pipe' });
            for (const slicePath of slicePaths) fs.rmSync(slicePath);
        }
    } catch (error) {
        console.warn('⚠ Trust helper compile failed — System-keychain trust will stay unavailable in this build');
        console.warn(`  ${error.message}`);
        for (const slicePath of slicePaths) fs.rmSync(slicePath, { force: true });
        fs.rmSync(binaryPath, { force: true });
        return;
    }
    signMacTrustHelper(binaryPath);
    const daemonsDir = path.join(contentsDir, 'Library', 'LaunchDaemons');
    fs.mkdirSync(daemonsDir, { recursive: true });
    fs.copyFileSync(
        path.join(helperSrcDir, 'io.openheaders.trust-helper.plist'),
        path.join(daemonsDir, 'io.openheaders.trust-helper.plist')
    );
    console.log(`✓ Trust helper embedded (${archNames.join('+')})`);
}

// electron-builder's signing walk over Contents/MacOS is alphabetical and
// 'OpenHeaders' sorts before 'oh-trust-helper', so the main-binary seal
// sees an unsigned nested binary and codesign refuses. Pre-signing the
// helper makes the walk order irrelevant; electron-builder's --force
// re-sign later in the pass keeps the seal consistent. Unsigned lanes
// (CSC_IDENTITY_AUTO_DISCOVERY=false) and keychains without a signing
// identity skip this — those builds are never sealed anyway.
function signMacTrustHelper(binaryPath) {
    if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') return;
    let identity = '';
    try {
        const out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
        identity = (out.match(/\b([0-9A-F]{40})\b/) || [])[1] || '';
    } catch {
        return;
    }
    if (!identity) return;
    execFileSync('codesign', ['--sign', identity, '--force', '--timestamp', '--options', 'runtime', binaryPath], {
        stdio: 'pipe',
    });
    console.log('✓ Trust helper signed');
}

// Copies the per-arch HTTP/3 helper staged by scripts/build-h3-helper.mjs
// into resources/h3-helper — the packaged path the runtime resolver
// reads. Runs before signing, so macOS builds seal it with the app.
// A missing stage ships the app helperless and the '3' HTTP-version
// pin fails honestly.
function embedH3Helper(context) {
    const { appOutDir, electronPlatformName } = context;
    const osName = electronPlatformName === 'darwin' ? 'mac' : electronPlatformName === 'win32' ? 'win' : 'linux';
    // electron-builder Arch enum: 1 = x64, 3 = arm64 (helper targets are per-arch; no universal build)
    const archName = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : null;
    if (archName === null) {
        console.warn(`⚠ HTTP/3 helper has no ${osName} build for arch enum ${context.arch} — shipping without it`);
        return;
    }
    const binaryName = osName === 'win' ? 'oh-h3-helper.exe' : 'oh-h3-helper';
    const source = path.join(__dirname, '..', '..', '..', '..', 'native', 'h3-helper', 'dist', `${osName}-${archName}`, binaryName);
    if (!fs.existsSync(source)) {
        console.warn(`⚠ HTTP/3 helper not staged at ${source} — shipping without it (the '3' HTTP-version pin stays inert)`);
        return;
    }
    const resourcesDir = electronPlatformName === 'darwin'
        ? path.join(appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
        : path.join(appOutDir, 'resources');
    const destDir = path.join(resourcesDir, 'h3-helper');
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, binaryName);
    fs.copyFileSync(source, dest);
    fs.chmodSync(dest, 0o755);
    console.log(`✓ HTTP/3 helper embedded (${osName}-${archName})`);
}

exports.default = async function(context) {
    const { appOutDir, electronPlatformName } = context;

    embedH3Helper(context);

    if (electronPlatformName === 'darwin') {
        embedMacTrustHelper(context);
        return;
    }

    // Windows builds — verify the native foreground module was unpacked
    if (electronPlatformName === 'win32') {
        const nativeModulePath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@openheaders', 'windows-foreground');
        if (fs.existsSync(nativeModulePath)) {
            console.log('✓ @openheaders/windows-foreground module found in unpacked resources');
        } else {
            console.warn('⚠ @openheaders/windows-foreground module not found in unpacked resources');
            console.warn(`  Expected path: ${nativeModulePath}`);
            console.warn('  Windows focus enhancement will use fallback methods');
        }
        return;
    }

    // Handle Linux builds
    if (electronPlatformName !== 'linux') {
        return;
    }

    console.log('Running afterPack hook for Linux build...');

    // Path to the source file in dist-webpack/main (copied there by electron-vite build)
    const sourceFile = path.join(process.cwd(), 'dist-webpack', 'main', 'install-open-headers.sh');

    // Path where we want to copy the file
    const destDir = path.dirname(appOutDir);
    const destFile = path.join(destDir, 'install-open-headers.sh');

    try {
        if (fs.existsSync(sourceFile)) {
            // Copy the file to the dist directory (alongside the AppImage)
            fs.copyFileSync(sourceFile, destFile);
            // Make it executable
            fs.chmodSync(destFile, 0o755);
            console.log(`Successfully copied ${sourceFile} to ${destFile}`);
        } else {
            console.error(`Source file not found: ${sourceFile}`);
        }
    } catch (error) {
        console.error('Error copying install script:', error);
    }
};