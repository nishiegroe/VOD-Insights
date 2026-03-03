#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

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

function runOrThrow(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: Boolean(options.shell),
  });
  if (result.error) {
    console.error(result.error instanceof Error ? result.error.message : String(result.error));
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(typeof result.status === 'number' ? result.status : 1);
  }
}

function runNpmOrThrow(args) {
  const runner = npmRunner();
  runOrThrow(runner.command, [...runner.baseArgs, ...args], { shell: runner.shell });
}

const extraArgs = process.argv.slice(2);
runNpmOrThrow(['run', 'build', '--', ...extraArgs]);
runNpmOrThrow(['run', 'release:assets', '--', ...extraArgs]);
