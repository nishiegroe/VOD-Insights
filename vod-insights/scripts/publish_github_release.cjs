#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {
    tag: '',
    owner: '',
    repo: '',
    outputDir: '',
    remote: 'origin',
    skipPrep: false,
    skipTag: false,
    dryRun: false,
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
    } else if (token === '--remote') {
      args.remote = argv[i + 1] || 'origin';
      i += 1;
    } else if (token === '--skip-prep') {
      args.skipPrep = true;
    } else if (token === '--skip-tag') {
      args.skipTag = true;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function npmRunner() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      baseArgs: [process.env.npm_execpath],
      shell: false,
    };
  }

  return {
    command: 'npm',
    baseArgs: [],
    shell: process.platform === 'win32',
  };
}

function runOrThrow(command, commandArgs, options = {}) {
  const spawnOptions = {
    stdio: 'inherit',
    shell: Boolean(options.shell),
  };
  if (options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  const result = spawnSync(command, commandArgs, spawnOptions);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
  }
}

function runNpmOrThrow(args, options = {}) {
  const runner = npmRunner();
  runOrThrow(runner.command, [...runner.baseArgs, ...args], {
    cwd: options.cwd,
    shell: runner.shell,
  });
}

function runCapture(command, commandArgs, options = {}) {
  const spawnOptions = {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  };
  if (options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  return spawnSync(command, commandArgs, spawnOptions);
}

function localTagExists(tag, root) {
  const result = runCapture('git', ['tag', '--list', tag], { cwd: root });
  if (result.status !== 0) {
    throw new Error(`Failed to check local tags: ${(result.stderr || '').trim()}`);
  }
  return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).includes(tag);
}

function remoteTagExists(tag, remote, root) {
  const result = runCapture('git', ['ls-remote', '--tags', remote, `refs/tags/${tag}`], { cwd: root });
  if (result.status !== 0) {
    throw new Error(`Failed to check remote tags on ${remote}: ${(result.stderr || '').trim()}`);
  }
  return Boolean(String(result.stdout || '').trim());
}

function ensureTagPushed(tag, remote, root, dryRun) {
  const localExists = localTagExists(tag, root);
  const remoteExists = remoteTagExists(tag, remote, root);

  if (dryRun) {
    if (!localExists) {
      console.log(`Dry run: would execute git tag ${tag}`);
    }
    if (!remoteExists) {
      console.log(`Dry run: would execute git push ${remote} ${tag}`);
    }
    return;
  }

  if (!localExists) {
    runOrThrow('git', ['tag', tag], { cwd: root });
  }

  if (!remoteExists) {
    runOrThrow('git', ['push', remote, tag], { cwd: root });
  }
}

function findInstaller(outputDir, version) {
  const installers = fs
    .readdirSync(outputDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.exe'))
    .filter((fileName) => fileName.includes(`-Setup-${version}`));

  if (installers.length === 0) {
    throw new Error(`No installer found in ${outputDir} for version ${version}.`);
  }

  return installers
    .map((name) => {
      const fullPath = path.join(outputDir, name);
      const stat = fs.statSync(fullPath);
      return { name, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].name;
}

function formatNotes(meta, version) {
  const title = `${meta.displayName || meta.internalName || 'Release'} v${version}`;
  const notes = Array.isArray(meta.patchNotes) ? meta.patchNotes : [];
  const match = notes.find((entry) => {
    if (typeof entry === 'string') return false;
    return String(entry?.version || '').trim() === String(version).trim();
  });

  if (!match) {
    return title;
  }

  const lines = [title, ''];
  if (Array.isArray(match.items) && match.items.length > 0) {
    lines.push(...match.items.map((item) => `- ${String(item)}`));
  } else if (typeof match.summary === 'string' && match.summary.trim()) {
    lines.push(match.summary.trim());
  } else {
    lines.push(`- Release ${version}`);
  }

  return lines.join('\n');
}

function shellEscape(arg) {
  if (!arg) return '""';
  if (!/[\s"']/g.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));

  const metaPath = path.join(root, 'app_meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Missing app metadata file: ${metaPath}`);
  }
  const meta = readJson(metaPath);
  const version = String(meta.version || '').trim();
  if (!version) {
    throw new Error('app_meta.json is missing a valid version.');
  }

  // Always use app_meta.json version for tag
  const tag = `v${version}`;
  if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error(`app_meta.json version is not valid for tag: ${tag}`);
  }

  const outputDir = args.outputDir
    ? path.resolve(root, args.outputDir)
    : path.join(root, 'dist-desktop', 'inno');

  if (!args.skipTag) {
    ensureTagPushed(tag, args.remote || 'origin', root, args.dryRun);
  }

  if (!args.skipPrep) {
    if (args.dryRun) {
      console.log(`Dry run: would execute npm run release:prep -- --tag ${tag}`);
    } else {
      runNpmOrThrow(['run', 'release:prep', '--', '--tag', tag], { cwd: root });
    }
  }

  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory does not exist: ${outputDir}`);
  }

  const installerName = findInstaller(outputDir, version);
  const installerPath = path.join(outputDir, installerName);
  const latestPath = path.join(outputDir, 'latest.json');
  const checksumsPath = path.join(outputDir, 'checksums.txt');

  if (!fs.existsSync(latestPath)) {
    throw new Error(`Missing release metadata file: ${latestPath}`);
  }
  if (!fs.existsSync(checksumsPath)) {
    throw new Error(`Missing checksum file: ${checksumsPath}`);
  }

  const { owner, repo } = resolveRepo(args);
  const notes = formatNotes(meta, version);
  const title = `${meta.displayName || meta.internalName || 'Release'} ${tag}`;

  const ghArgs = [
    'release',
    'create',
    tag,
    path.relative(root, installerPath),
    path.relative(root, latestPath),
    path.relative(root, checksumsPath),
    '--repo',
    `${owner}/${repo}`,
    '--title',
    title,
    '--notes',
    notes,
    '--verify-tag',
  ];

  if (args.dryRun) {
    console.log('Dry run: would execute');
    console.log(`gh ${ghArgs.map(shellEscape).join(' ')}`);
    console.log('');
    console.log('Notes preview:');
    console.log(notes);
    return;
  }

  runOrThrow('gh', ghArgs, { cwd: root });
}

main();
