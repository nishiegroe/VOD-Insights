#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function parseArgs(argv) {
  const args = {
    tag: '',
    owner: '',
    repo: '',
    outputDir: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--tag') {
      args.tag = argv[i + 1] || '';
      i += 1;
    } else if (token === '--owner') {
      args.owner = argv[i + 1] || '';
      i += 1;
    } else if (token === '--repo') {
      args.repo = argv[i + 1] || '';
      i += 1;
    } else if (token === '--output-dir') {
      args.outputDir = argv[i + 1] || '';
      i += 1;
    }
  }

  return args;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    stream.on('error', (error) => {
      reject(error);
    });
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
  });
}

function resolveRepo(args) {
  let owner = args.owner;
  let repo = args.repo;

  if ((!owner || !repo) && process.env.GITHUB_REPOSITORY) {
    const [repoOwner, repoName] = process.env.GITHUB_REPOSITORY.split('/');
    if (!owner) owner = repoOwner || '';
    if (!repo) repo = repoName || '';
  }

  if (!owner) owner = 'nishiegroe';
  if (!repo) repo = 'VOD-Insights';

  return { owner, repo };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));

  const metaPath = path.join(root, 'app_meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Missing app metadata file: ${metaPath}`);
  }
  const appMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const version = String(appMeta.version || '').trim();
  if (!version) {
    throw new Error('app_meta.json is missing a valid version.');
  }

  const tag = args.tag || process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || '';
  if (!tag) {
    throw new Error('Missing release tag. Pass --tag vX.Y.Z or set RELEASE_TAG.');
  }
  if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error(`Tag must match vX.Y.Z format, received: ${tag}`);
  }

  const expectedTag = `v${version}`;
  if (tag !== expectedTag) {
    throw new Error(`Version mismatch: app_meta.json=${version}, tag=${tag}. Expected tag ${expectedTag}.`);
  }

  const outputDir = args.outputDir
    ? path.resolve(root, args.outputDir)
    : path.join(root, 'dist-desktop', 'inno');
  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory does not exist: ${outputDir}`);
  }

  const installers = fs
    .readdirSync(outputDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.exe'))
    .filter((fileName) => fileName.includes(`-Setup-${version}`));

  if (installers.length === 0) {
    throw new Error(`No installer found in ${outputDir} for version ${version}.`);
  }

  const installerName = installers
    .map((name) => {
      const fullPath = path.join(outputDir, name);
      const stat = fs.statSync(fullPath);
      return { name, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].name;

  const installerPath = path.join(outputDir, installerName);
  const installerStat = fs.statSync(installerPath);
  const installerSha256 = await sha256File(installerPath);
  const { owner, repo } = resolveRepo(args);
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(installerName)}`;

  const latest = {
    version,
    tag,
    publishedAt: new Date().toISOString(),
    notesUrl: `https://github.com/${owner}/${repo}/releases/tag/${tag}`,
    installer: {
      name: installerName,
      url: releaseUrl,
      sha256: installerSha256,
      size: installerStat.size,
    },
    minimumSupportedVersion: version,
  };

  const latestPath = path.join(outputDir, 'latest.json');
  fs.writeFileSync(latestPath, `${JSON.stringify(latest, null, 2)}\n`, 'utf8');

  const checksumsPath = path.join(outputDir, 'checksums.txt');
  const checksumsContent = `${installerSha256}  ${installerName}\n`;
  fs.writeFileSync(checksumsPath, checksumsContent, 'utf8');

  console.log(`Prepared release assets in ${outputDir}`);
  console.log(`- Installer: ${installerName}`);
  console.log(`- Checksum: ${checksumsPath}`);
  console.log(`- Metadata: ${latestPath}`);
  console.log('');
  console.log('Suggested upload command (GitHub CLI):');
  console.log(`gh release create ${tag} "${path.relative(root, installerPath)}" "${path.relative(root, latestPath)}" "${path.relative(root, checksumsPath)}" --title "${appMeta.displayName || appMeta.internalName || 'Release'} ${tag}" --notes "${appMeta.displayName || appMeta.internalName || 'App'} ${tag}"`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
