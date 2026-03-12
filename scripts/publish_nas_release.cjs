#!/usr/bin/env node
/**
 * Copies release artifacts from dist-desktop/inno/ to the NAS via SMB.
 *
 * Usage:
 *   node scripts/publish_nas_release.cjs
 *   node scripts/publish_nas_release.cjs --nas-path "\\server.nishiegroe.com\share\vod-insights"
 *
 * Or set AET_NAS_SMB_PATH in your environment.
 */
const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { nasPath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--nas-path') {
      args.nasPath = argv[i + 1] || '';
      i += 1;
    }
  }
  return args;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));

  const nasPath = args.nasPath || process.env.AET_NAS_SMB_PATH || '';
  if (!nasPath) {
    throw new Error(
      'NAS SMB path is required. Pass --nas-path "\\\\server\\share\\subfolder" or set AET_NAS_SMB_PATH.'
    );
  }

  const metaPath = path.join(root, 'app_meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Missing app metadata file: ${metaPath}`);
  }
  const appMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const version = String(appMeta.version || '').trim();
  if (!version) {
    throw new Error('app_meta.json is missing a valid version.');
  }

  const outputDir = path.join(root, 'dist-desktop', 'inno');
  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory does not exist: ${outputDir}. Run the build first.`);
  }

  // Find the installer for this version
  const installers = fs
    .readdirSync(outputDir)
    .filter((f) => f.toLowerCase().endsWith('.exe') && f.includes(`-Setup-${version}`));

  if (installers.length === 0) {
    throw new Error(`No installer found in ${outputDir} for version ${version}. Run the build first.`);
  }

  const installerName = installers
    .map((name) => ({ name, mtimeMs: fs.statSync(path.join(outputDir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].name;

  const artifacts = [
    installerName,
    'latest.json',
    'checksums.txt',
  ];

  // Ensure destination exists
  if (!fs.existsSync(nasPath)) {
    throw new Error(`NAS destination path does not exist or is not accessible: ${nasPath}`);
  }

  console.log(`Publishing v${version} to ${nasPath} ...`);
  for (const fileName of artifacts) {
    const src = path.join(outputDir, fileName);
    const dst = path.join(nasPath, fileName);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing artifact: ${src}. Run npm run release:prep first.`);
    }
    fs.copyFileSync(src, dst);
    console.log(`  ✓ ${fileName}`);
  }

  // Keep Marketing/public/latest.json in sync so the next marketing site build
  // picks up the new version without manually copying the file.
  const marketingPublicLatest = path.join(root, 'Marketing', 'public', 'latest.json');
  fs.copyFileSync(path.join(outputDir, 'latest.json'), marketingPublicLatest);
  console.log(`  ✓ Marketing/public/latest.json updated`);

  console.log('');
  console.log(`Done. Files are live at:`);
  console.log(`  https://server.nishiegroe.com/d/s/17O8FTJqXgRqxWSs5bvCoaBMjcfIUdSt/latest.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
