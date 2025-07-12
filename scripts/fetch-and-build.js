#!/usr/bin/env bun

/**
 * Fetch Claude Code package from npm and build executables for all platforms
 * 
 * This script:
 * 1. Downloads the @anthropic-ai/claude-code package from npm
 * 2. Extracts it to a temporary directory
 * 3. Runs the build-executables script to create binaries for all platforms
 * 4. Cleans up temporary files
 * 
 * Usage:
 *   bun run fetch-and-build.js [platform] [--version=X.X.X]
 * 
 * Where platform can be: all, linux, macos, windows, current
 * 
 * Version can be specified via:
 *   - CLI argument: --version=1.0.41 (defaults to 1.0.41 if not specified)
 */

import { spawn } from 'child_process';
import { mkdir, rm, readdir, copyFile, access, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Cross-platform recursive directory copy function
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 */
async function copyDirectory(src, dest) {
  try {
    // Create destination directory
    await mkdir(dest, { recursive: true });
    
    // Read the source directory
    const entries = await readdir(src, { withFileTypes: true });
    
    // Copy each entry
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        await copyDirectory(srcPath, destPath);
      } else {
        // Copy file
        await copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    throw new Error(`Failed to copy directory from ${src} to ${dest}: ${error.message}`);
  }
}

/**
 * Execute a shell command and return a promise
 * @param {string} command - The command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 * @returns {Promise<void>}
 */
async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { 
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options 
    });
    
    child.on('error', (error) => {
      console.error(`Failed to execute command: ${error.message}`);
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

/**
 * Check if a path exists
 * @param {string} path - Path to check
 * @returns {Promise<boolean>}
 */
async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {object} - Parsed arguments
 */
function parseArguments(args) {
  const platform = args.find(arg => !arg.startsWith('--')) || 'all';
  
  // Extract version from --version=X.X.X format
  const versionArg = args.find(arg => arg.startsWith('--version='));
  const version = versionArg ? versionArg.split('=')[1] : null;
  
  return { platform, version };
}

/**
 * Determine the Claude Code version to use
 * @param {string|null} cliVersion - Version specified via CLI
 * @returns {string} - Version to use
 */
function determineClaudeCodeVersion(cliVersion) {
  if (cliVersion) {
    console.log(`Using CLI-specified version: ${cliVersion}`);
    return cliVersion;
  }
  
  // Default version
  const defaultVersion = '1.0.41';
  console.log(`Using default version: ${defaultVersion}`);
  return defaultVersion;
}

/**
 * Cross-platform tar extraction using Node.js
 * @param {string} tarballPath - Path to the tarball
 * @param {string} extractDir - Directory to extract to
 */
async function extractTarball(tarballPath, extractDir) {
  if (process.platform === 'win32') {
    // On Windows, try to use tar if available (Windows 10+ has built-in tar)
    try {
      await runCommand('tar', ['-xzf', tarballPath], { cwd: extractDir });
    } catch (error) {
      // If tar fails, try using PowerShell
      console.log('Built-in tar failed, trying PowerShell...');
      await runCommand('powershell', [
        '-Command',
        `Expand-Archive -Path "${tarballPath}" -DestinationPath "${extractDir}" -Force`
      ]);
    }
  } else {
    // On Unix/Linux/macOS, use tar
    await runCommand('tar', ['-xzf', tarballPath], { cwd: extractDir });
  }
}

/**
 * Download and extract the Claude Code package from npm
 * @param {string} version - The version of the Claude Code package to download
 * @returns {Promise<string>} - Path to the extracted package directory
 */
async function fetchClaudeCodePackage(version) {
  console.log(`\n📦 Fetching @anthropic-ai/claude-code@${version} package from npm...`);
  
  const tempDir = resolve('./temp-claude-package');
  const packageDir = join(tempDir, 'package');
  
  try {
    // Clean up any existing temp directory
    if (await pathExists(tempDir)) {
      console.log('Cleaning up existing temp directory...');
      await rm(tempDir, { recursive: true, force: true });
    }
    
    // Create temp directory
    await mkdir(tempDir, { recursive: true });
    
    // Download the package tarball
    console.log(`Downloading package tarball for version ${version}...`);
    await runCommand('npm', ['pack', `@anthropic-ai/claude-code@${version}`], { 
      cwd: tempDir 
    });
    
    // Find the downloaded tarball
    const files = await readdir(tempDir);
    const tarball = files.find(file => file.startsWith('anthropic-ai-claude-code-') && file.endsWith('.tgz'));
    
    if (!tarball) {
      throw new Error('Failed to find downloaded tarball');
    }
    
    console.log(`Found tarball: ${tarball}`);
    
    // Extract the tarball using cross-platform method
    console.log('Extracting package...');
    await extractTarball(join(tempDir, tarball), tempDir);
    
    // Verify extraction
    if (!(await pathExists(packageDir))) {
      throw new Error('Package extraction failed - package directory not found');
    }
    
    console.log(`✓ Package extracted to: ${packageDir}`);
    return packageDir;
    
  } catch (error) {
    // Clean up on error
    if (await pathExists(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

/**
 * Copy required files from the Claude Code package to current directory
 * @param {string} packageDir - Path to the extracted package directory
 */
async function copyRequiredFiles(packageDir) {
  console.log('\n📋 Copying required files from Claude Code package...');
  
  const filesToCopy = [
    'cli.js',
    'yoga.wasm'
  ];
  
  const directoriesToCopy = [
    'vendor'
  ];
  
  // Copy individual files
  for (const file of filesToCopy) {
    const srcPath = join(packageDir, file);
    const destPath = resolve(file);
    
    if (await pathExists(srcPath)) {
      console.log(`Copying ${file}...`);
      await copyFile(srcPath, destPath);
    } else {
      console.warn(`Warning: ${file} not found in package`);
    }
  }
  
  // Copy directories recursively
  for (const dir of directoriesToCopy) {
    const srcPath = join(packageDir, dir);
    const destPath = resolve(dir);
    
    if (await pathExists(srcPath)) {
      console.log(`Copying ${dir}/ directory...`);
      
      // Remove existing directory if it exists
      if (await pathExists(destPath)) {
        await rm(destPath, { recursive: true, force: true });
      }
      
      // Copy directory recursively using cross-platform function
      await copyDirectory(srcPath, destPath);
    } else {
      console.warn(`Warning: ${dir}/ directory not found in package`);
    }
  }
  
  console.log('✓ Required files copied successfully');
}

/**
 * Clean up temporary files and directories
 * @param {string} packageDir - Path to the package directory to clean up
 */
async function cleanup(packageDir) {
  console.log('\n🧹 Cleaning up temporary files...');
  
  const tempDir = resolve('./temp-claude-package');
  
  try {
    if (await pathExists(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
      console.log('✓ Temporary package directory cleaned up');
    }
    
    // Clean up copied files that are no longer needed
    const filesToCleanup = [
      './cli.js',
      './cli-bundled.js',
      './cli-native-bundled.js',
      './yoga.wasm'
    ];
    
    for (const file of filesToCleanup) {
      if (await pathExists(file)) {
        await rm(file);
      }
    }
    
    // Clean up vendor directory
    const vendorDir = './vendor';
    if (await pathExists(vendorDir)) {
      await rm(vendorDir, { recursive: true, force: true });
    }
    
    console.log('✓ Cleanup completed');
  } catch (error) {
    console.warn(`Warning: Cleanup failed: ${error.message}`);
  }
}

/**
 * Build executables for the specified platform(s)
 * @param {string} platform - Platform to build for (all, linux, macos, windows, current)
 */
async function buildExecutables(platform = 'all') {
  console.log(`\n🔨 Building executables for platform: ${platform}`);
  
  // Ensure src-tauri/binaries directory exists
  if (!await pathExists('./src-tauri/binaries')) {
    await mkdir('./src-tauri/binaries', { recursive: true });
  }
  
  // Run the build-executables script
  const args = platform === 'all' ? [] : [platform];
  await runCommand('bun', ['run', './scripts/build-executables.js', ...args]);
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const { platform, version: cliVersion } = parseArguments(args);
  
  const validPlatforms = ['all', 'linux', 'macos', 'darwin', 'windows', 'win32', 'current'];
  
  if (!validPlatforms.includes(platform)) {
    console.error(`Invalid platform: ${platform}`);
    console.error(`Valid platforms: ${validPlatforms.join(', ')}`);
    console.error('\nUsage: bun run fetch-and-build.js [platform] [--version=X.X.X]');
    console.error('Examples:');
    console.error('  bun run fetch-and-build.js');
    console.error('  bun run fetch-and-build.js linux');
    console.error('  bun run fetch-and-build.js macos --version=1.0.42');
    process.exit(1);
  }
  
  console.log('🚀 Starting Claude Code fetch and build process...');
  console.log(`Target platform: ${platform}`);
  
  const startTime = Date.now();
  let packageDir;
  
  try {
    // Step 1: Determine version to use
    const version = determineClaudeCodeVersion(cliVersion);
    
    // Step 2: Fetch and extract the package
    packageDir = await fetchClaudeCodePackage(version);
    
    // Step 3: Copy required files
    await copyRequiredFiles(packageDir);
    
    // Step 4: Build executables
    await buildExecutables(platform);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Build process completed successfully in ${totalTime}s`);
    console.log('\n📁 Executables are available in the src-tauri/binaries/ directory');
    
  } catch (error) {
    console.error(`\n❌ Build process failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Always clean up, even if there was an error
    if (packageDir) {
      await cleanup(packageDir);
    }
  }
}

// Run the main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
}); 
