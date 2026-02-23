#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

function runOrThrow(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

const extraArgs = process.argv.slice(2);
runOrThrow(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--', ...extraArgs]);
runOrThrow(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'release:assets', '--', ...extraArgs]);
