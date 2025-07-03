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
 *   bun run fetch-and-build.js [platform]
 * 
 * Where platform can be: all, linux, macos, windows, current
 */

import { spawn } from 'child_process';
import { mkdir, rm, readdir, copyFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

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
 * Check if a file or directory exists
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
 * Download and extract the Claude Code package from npm
 * @returns {Promise<string>} - Path to the extracted package directory
 */
async function fetchClaudeCodePackage() {
  console.log('\n📦 Fetching @anthropic-ai/claude-code package from npm...');
  
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
    console.log('Downloading package tarball...');
    await runCommand('npm', ['pack', '@anthropic-ai/claude-code'], { 
      cwd: tempDir 
    });
    
    // Find the downloaded tarball
    const files = await readdir(tempDir);
    const tarball = files.find(file => file.startsWith('anthropic-ai-claude-code-') && file.endsWith('.tgz'));
    
    if (!tarball) {
      throw new Error('Failed to find downloaded tarball');
    }
    
    console.log(`Found tarball: ${tarball}`);
    
    // Extract the tarball
    console.log('Extracting package...');
    await runCommand('tar', ['-xzf', tarball], { 
      cwd: tempDir 
    });
    
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
      
      // Copy directory recursively using cp command
      await runCommand('cp', ['-r', srcPath, destPath]);
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
  const platform = process.argv[2] || 'all';
  const validPlatforms = ['all', 'linux', 'macos', 'darwin', 'windows', 'win32', 'current'];
  
  if (!validPlatforms.includes(platform)) {
    console.error(`Invalid platform: ${platform}`);
    console.error(`Valid platforms: ${validPlatforms.join(', ')}`);
    process.exit(1);
  }
  
  console.log('🚀 Starting Claude Code fetch and build process...');
  console.log(`Target platform: ${platform}`);
  
  const startTime = Date.now();
  let packageDir;
  
  try {
    // Step 1: Fetch and extract the package
    packageDir = await fetchClaudeCodePackage();
    
    // Step 2: Copy required files
    await copyRequiredFiles(packageDir);
    
    // Step 3: Build executables
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
