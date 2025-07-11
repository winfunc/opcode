#!/usr/bin/env bun

/**
 * Enhanced Tauri build script with AppImage support
 * This script wraps the standard tauri build command and adds proper AppImage handling
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function print(type, message) {
  const color = colors[type] || colors.reset;
  console.log(`${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildAppImage() {
  const PROJECT_NAME = "Claudia";
  const VERSION = process.env.npm_package_version || "0.1.0";
  const ARCH = process.arch === 'x64' ? 'x86_64' : process.arch;
  const DEBIAN_ARCH = process.arch === 'x64' ? 'amd64' : process.arch === 'arm64' ? 'arm64' : process.arch;
  const APPIMAGE_NAME = `${PROJECT_NAME}_${VERSION}_${DEBIAN_ARCH}.AppImage`;
  const APPDIR_PATH = `src-tauri/target/release/bundle/appimage/${PROJECT_NAME}.AppDir`;
  const APPIMAGE_PATH = `src-tauri/target/release/bundle/appimage/${APPIMAGE_NAME}`;

  print('info', 'Starting enhanced Tauri build with AppImage support...');

  // Step 1: Run the standard tauri build
  try {
    await runCommand('tauri', ['build', '--bundles', 'appimage']);
  } catch (error) {
    print('warning', 'Tauri build failed at AppImage creation.');
  }

  // Step 2: Check if AppDir was created
  if (!existsSync(APPDIR_PATH)) {
    print('error', 'AppDir was not created. Build failed.');
    process.exit(1);
  }

  print('success', 'AppDir created successfully');

  // Step 3: Check if appimagetool is available
  try {
    await runCommand('which', ['appimagetool']);
  } catch (error) {
    print('error', 'appimagetool is not installed. Please install it first.');
    print('info', 'On Ubuntu/Debian: sudo apt install appimagetool');
    print('info', 'Or download from: https://github.com/AppImage/AppImageKit/releases');
    process.exit(1);
  }

  // Step 4: Create the AppImage manually
  print('info', 'Creating AppImage using appimagetool...');

  // Remove existing AppImage if it exists
  if (existsSync(APPIMAGE_PATH)) {
    print('info', 'Removing existing AppImage...');
    try {
      await runCommand('rm', [APPIMAGE_PATH]);
    } catch (error) {
      print('warning', 'Failed to remove existing AppImage');
    }
  }

    // Fix icon issue - copy icon to lowercase name
  const iconPath = `src-tauri/target/release/bundle/appimage/${PROJECT_NAME}.AppDir/claudia.png`;
  const sourceIconPath = `src-tauri/target/release/bundle/appimage/${PROJECT_NAME}.AppDir/${PROJECT_NAME}.png`;

  try {
    await runCommand('cp', [sourceIconPath, iconPath]);
    print('info', 'Fixed icon naming issue');
  } catch (error) {
    print('warning', 'Could not fix icon naming, continuing anyway');
  }

  // Create the AppImage using absolute paths
  const bundleDir = `src-tauri/target/release/bundle/appimage`;
  const absoluteBundleDir = join(process.cwd(), bundleDir);
  const absoluteAppDir = join(absoluteBundleDir, `${PROJECT_NAME}.AppDir`);
  const absoluteAppImage = join(absoluteBundleDir, APPIMAGE_NAME);

  try {
    await runCommand('appimagetool', [
      absoluteAppDir,
      absoluteAppImage
    ], {
      env: { ...process.env, ARCH }
    });

    print('success', 'AppImage created successfully!');
    print('info', `AppImage location: ${APPIMAGE_PATH}`);

    // Get file size
    try {
      const { stdout } = await new Promise((resolve, reject) => {
        const child = spawn('du', ['-h', APPIMAGE_PATH], { stdio: 'pipe' });
        let stdout = '';
        child.stdout.on('data', (data) => stdout += data.toString());
        child.on('close', (code) => resolve({ stdout }));
        child.on('error', reject);
      });
      const size = stdout.split('\t')[0];
      print('info', `AppImage size: ${size}`);
    } catch (error) {
      // Size check failed, but that's not critical
    }

  } catch (error) {
    print('error', 'Failed to create AppImage');
    print('error', error.message);
    process.exit(1);
  }

  // Step 5: Copy to dist directory
  print('info', 'Copying AppImage to dist directory...');
  try {
    await runCommand('mkdir', ['-p', 'dist']);
    await runCommand('cp', [APPIMAGE_PATH, `dist/${APPIMAGE_NAME}`]);
    print('success', `AppImage copied to dist/${APPIMAGE_NAME}`);
  } catch (error) {
    print('warning', 'Failed to copy AppImage to dist directory');
  }

  // Step 6: Make it executable
  try {
    await runCommand('chmod', ['+x', APPIMAGE_PATH]);
    await runCommand('chmod', ['+x', `dist/${APPIMAGE_NAME}`]);
  } catch (error) {
    print('warning', 'Failed to make AppImage executable');
  }

  print('success', 'Enhanced Tauri build completed successfully!');
  console.log('');
  print('info', 'To run the AppImage:');
  console.log(`  WEBKIT_DISABLE_COMPOSITING_MODE=1 ./${APPIMAGE_PATH}`);
  console.log('');
  print('info', 'Or from dist directory:');
  console.log(`  WEBKIT_DISABLE_COMPOSITING_MODE=1 ./dist/${APPIMAGE_NAME}`);
}

async function buildStandard() {
  print('info', 'Running standard Tauri build...');

  // Parse command line arguments to pass through
  const args = process.argv.slice(2);

  try {
    await runCommand('tauri', ['build', ...args]);
    print('success', 'Standard Tauri build completed successfully!');
  } catch (error) {
    print('error', 'Standard Tauri build failed');
    print('error', error.message);
    process.exit(1);
  }
}

async function main() {
  // Check if we're in the right directory
  if (!existsSync('src-tauri/tauri.conf.json')) {
    print('error', 'Please run this script from the project root directory');
    process.exit(1);
  }

  // Check command line arguments
  const args = process.argv.slice(2);
  const isAppImageBuild = args.includes('--bundles') && args.includes('appimage') ||
                          args.includes('--bundles=appimage') ||
                          args.some(arg => arg.startsWith('--bundles') && arg.includes('appimage'));

  if (isAppImageBuild && process.platform === 'linux') {
    await buildAppImage();
  } else {
    await buildStandard();
  }
}

// Run the main function
main().catch((error) => {
  print('error', `Script failed: ${error.message}`);
  process.exit(1);
});
