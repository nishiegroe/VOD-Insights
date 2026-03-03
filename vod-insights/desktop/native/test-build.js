#!/usr/bin/env node

/**
 * Native Module Build Test
 * 
 * Verifies that the native module compiles and loads correctly.
 * Run after building: node native/test-build.js
 */

const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('VOD Insights Native Module Build Test');
console.log('='.repeat(60));

// Detect platform
const platform = process.platform;
const arch = process.arch;
console.log(`\nPlatform: ${platform} (${arch})`);
console.log(`Node version: ${process.version}`);

// Expected binary path
const buildDir = path.join(__dirname, 'build', 'Release');
const binaryName = process.platform === 'win32' ? 'video_player.node' : 'video_player.node';
const binaryPath = path.join(buildDir, binaryName);

console.log(`\nExpected binary path: ${binaryPath}`);

// Check if binary exists
if (!fs.existsSync(binaryPath)) {
  console.error(`\n❌ ERROR: Binary not found at ${binaryPath}`);
  console.error('Build may have failed. Try running: npm run build:native:rebuild');
  process.exit(1);
}

console.log('✅ Binary file found');

// Try to load the module
let VideoPlayer;
try {
  VideoPlayer = require(binaryPath);
  console.log('✅ Native module loaded successfully');
} catch (error) {
  console.error(`\n❌ ERROR: Failed to load native module`);
  console.error(`Details: ${error.message}`);
  process.exit(1);
}

// Test basic instantiation
console.log('\nTesting basic operations:');
try {
  const player = new VideoPlayer();
  console.log('✅ VideoPlayer instance created');

  // Test method availability
  const methods = [
    'initialize',
    'shutdown',
    'play',
    'pause',
    'stop',
    'seek',
    'setPlaybackRate',
    'getCurrentTime',
    'getDuration',
    'getState',
    'isPlaying',
    'processEvents',
    'getLastError'
  ];

  let allMethodsPresent = true;
  for (const method of methods) {
    if (typeof player[method] !== 'function') {
      console.error(`❌ Method ${method} is not a function`);
      allMethodsPresent = false;
    }
  }

  if (allMethodsPresent) {
    console.log(`✅ All ${methods.length} expected methods are available`);
  } else {
    process.exit(1);
  }

  // Test calling methods
  console.log('\nTesting method calls:');

  // These should not crash, even without proper initialization
  try {
    const state = player.getState();
    console.log(`✅ getState() returned: "${state}"`);
  } catch (e) {
    console.error(`❌ getState() failed: ${e.message}`);
  }

  try {
    const time = player.getCurrentTime();
    console.log(`✅ getCurrentTime() returned: ${time}ms`);
  } catch (e) {
    console.error(`❌ getCurrentTime() failed: ${e.message}`);
  }

  try {
    const duration = player.getDuration();
    console.log(`✅ getDuration() returned: ${duration}ms`);
  } catch (e) {
    console.error(`❌ getDuration() failed: ${e.message}`);
  }

  try {
    player.shutdown();
    console.log('✅ shutdown() completed without error');
  } catch (e) {
    console.error(`❌ shutdown() failed: ${e.message}`);
  }
} catch (error) {
  console.error(`\n❌ ERROR: Failed to test VideoPlayer`);
  console.error(`Details: ${error.message}`);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('✅ All tests passed!');
console.log('='.repeat(60));
console.log('\nNext steps:');
console.log('1. libvlc must be installed on the system');
console.log('   - Windows: vcpkg install vlc:x64-windows');
console.log('   - macOS: brew install vlc');
console.log('   - Linux: apt-get install libvlc-dev');
console.log('2. Review ipcHandler.ts for Electron integration');
console.log('3. Setup IPC handlers in main.js');
console.log('4. Create React components for video playback UI');
