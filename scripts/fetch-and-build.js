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
 *   - CLI argument: --version=1.0.83 (defaults to 1.0.83 if not specified)
 */

import { spawn } from "child_process";
import { mkdir, rm, readdir, copyFile, access } from "fs/promises";
// import { existsSync } from 'fs'; // Removed unused import
import { join, resolve } from "path";

// Logger functions
const isDev = process.env.NODE_ENV !== "production";
const log = {
  debug: (...args) => isDev && console.log("[DEBUG]", ...args), // eslint-disable-line no-console
  info: (...args) => console.log("[INFO]", ...args), // eslint-disable-line no-console
  warn: (...args) => console.warn("[WARN]", ...args), // eslint-disable-line no-console
  error: (...args) => console.error("[ERROR]", ...args), // eslint-disable-line no-console
};

/**
 * Execute a shell command and return a promise
 * @param {string} command - The command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 * @returns {Promise<void>}
 */
async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log.info(`Running: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("error", (error) => {
      log.error(`Failed to execute command: ${error.message}`);
      reject(error);
    });

    child.on("exit", (code) => {
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
 * Parse command line arguments to extract version and platform
 * @param {string[]} args - Command line arguments
 * @returns {object} - Parsed arguments with platform and version
 */
function parseArguments(args) {
  let platform = "all";
  let version = null;

  for (const arg of args) {
    if (arg.startsWith("--version=")) {
      version = arg.split("=")[1];
    } else if (!arg.startsWith("--")) {
      platform = arg;
    }
  }

  return { platform, version };
}

/**
 * Determine the Claude Code version to use
 * @param {string|null} cliVersion - Version from CLI argument
 * @returns {string} - The version to use
 */
function determineClaudeCodeVersion(cliVersion) {
  const defaultVersion = "1.0.83";

  if (cliVersion) {
    log.info(`\n🔍 Using Claude Code version from CLI argument: ${cliVersion}`);
    return cliVersion;
  }

  log.info(`\n🔍 Using default Claude Code version: ${defaultVersion}`);
  return defaultVersion;
}

/**
 * Download and extract the Claude Code package from npm
 * @param {string} version - The version of the Claude Code package to download
 * @returns {Promise<string>} - Path to the extracted package directory
 */
async function fetchClaudeCodePackage(version) {
  log.info(`\n📦 Fetching @anthropic-ai/claude-code@${version} package from npm...`);

  const tempDir = resolve("./temp-claude-package");
  const packageDir = join(tempDir, "package");

  try {
    // Clean up any existing temp directory
    if (await pathExists(tempDir)) {
      log.info("Cleaning up existing temp directory...");
      await rm(tempDir, { recursive: true, force: true });
    }

    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Download the package tarball
    log.info(`Downloading package tarball for version ${version}...`);
    await runCommand("npm", ["pack", `@anthropic-ai/claude-code@${version}`], {
      cwd: tempDir,
    });

    // Find the downloaded tarball
    const files = await readdir(tempDir);
    const tarball = files.find(
      (file) => file.startsWith("anthropic-ai-claude-code-") && file.endsWith(".tgz")
    );

    if (!tarball) {
      throw new Error("Failed to find downloaded tarball");
    }

    log.info(`Found tarball: ${tarball}`);

    // Extract the tarball
    log.info("Extracting package...");
    await runCommand("tar", ["-xzf", tarball], {
      cwd: tempDir,
    });

    // Verify extraction
    if (!(await pathExists(packageDir))) {
      throw new Error("Package extraction failed - package directory not found");
    }

    log.info(`�?Package extracted to: ${packageDir}`);
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
  log.info("\n📋 Copying required files from Claude Code package...");

  const filesToCopy = ["cli.js", "yoga.wasm"];

  const directoriesToCopy = ["vendor"];

  // Copy individual files
  for (const file of filesToCopy) {
    const srcPath = join(packageDir, file);
    const destPath = resolve(file);

    if (await pathExists(srcPath)) {
      log.info(`Copying ${file}...`);
      await copyFile(srcPath, destPath);
    } else {
      log.warn(`Warning: ${file} not found in package`);
    }
  }

  // Copy directories recursively
  for (const dir of directoriesToCopy) {
    const srcPath = join(packageDir, dir);
    const destPath = resolve(dir);

    if (await pathExists(srcPath)) {
      log.info(`Copying ${dir}/ directory...`);

      // Remove existing directory if it exists
      if (await pathExists(destPath)) {
        await rm(destPath, { recursive: true, force: true });
      }

      // Copy directory recursively - use platform-appropriate method
      if (process.platform === "win32") {
        // Windows: use robocopy or xcopy
        try {
          await runCommand("robocopy", [
            srcPath,
            destPath,
            "/E",
            "/NFL",
            "/NDL",
            "/NJH",
            "/NJS",
            "/nc",
            "/ns",
            "/np",
          ]);
        } catch (error) {
          // robocopy returns exit code 1 for successful copy, so we need to handle this
          if (error.message.includes("exit code 1")) {
            // Exit code 1 means files were copied successfully
            log.info("�?Directory copied successfully with robocopy");
          } else {
            // Try xcopy as fallback
            await runCommand("xcopy", [srcPath, destPath, "/E", "/I", "/Q"]);
          }
        }
      } else {
        // Unix/Linux/macOS: use cp command
        await runCommand("cp", ["-r", srcPath, destPath]);
      }
    } else {
      log.warn(`Warning: ${dir}/ directory not found in package`);
    }
  }

  log.info("�?Required files copied successfully");
}

/**
 * Clean up temporary files and directories
 * @param {string} _packageDir - Path to the package directory to clean up (unused)
 */
async function cleanup(_packageDir) {
  log.info("\n🧹 Cleaning up temporary files...");

  const tempDir = resolve("./temp-claude-package");

  try {
    if (await pathExists(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
      log.info("�?Temporary package directory cleaned up");
    }

    // Clean up copied files that are no longer needed
    const filesToCleanup = [
      "./cli.js",
      "./cli-bundled.js",
      "./cli-native-bundled.js",
      "./yoga.wasm",
    ];

    for (const file of filesToCleanup) {
      if (await pathExists(file)) {
        await rm(file);
      }
    }

    // Clean up vendor directory
    const vendorDir = "./vendor";
    if (await pathExists(vendorDir)) {
      await rm(vendorDir, { recursive: true, force: true });
    }

    log.info("�?Cleanup completed");
  } catch (error) {
    log.warn(`Warning: Cleanup failed: ${error.message}`);
  }
}

/**
 * Build executables for the specified platform(s)
 * @param {string} platform - Platform to build for (all, linux, macos, windows, current)
 */
async function buildExecutables(platform = "all") {
  log.info(`\n🔨 Building executables for platform: ${platform}`);

  // Ensure src-tauri/binaries directory exists
  if (!(await pathExists("./src-tauri/binaries"))) {
    await mkdir("./src-tauri/binaries", { recursive: true });
  }

  // Run the build-executables script
  const args = platform === "all" ? [] : [platform];
  await runCommand("bun", ["run", "./scripts/build-executables.js", ...args]);
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const { platform, version: cliVersion } = parseArguments(args);

  const validPlatforms = ["all", "linux", "macos", "darwin", "windows", "win32", "current"];

  if (!validPlatforms.includes(platform)) {
    log.error(`Invalid platform: ${platform}`);
    log.error(`Valid platforms: ${validPlatforms.join(", ")}`);
    log.error("\nUsage: bun run fetch-and-build.js [platform] [--version=X.X.X]");
    log.error("Examples:");
    log.error("  bun run fetch-and-build.js");
    log.error("  bun run fetch-and-build.js linux");
    log.error("  bun run fetch-and-build.js macos --version=1.0.83");
    process.exit(1);
  }

  log.info("🚀 Starting Claude Code fetch and build process...");
  log.info(`Target platform: ${platform}`);

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
    log.info(`\n�?Build process completed successfully in ${totalTime}s`);
    log.info("\n📁 Executables are available in the src-tauri/binaries/ directory");
  } catch (error) {
    log.error(`\n�?Build process failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Always clean up, even if there was an error
    if (packageDir) {
      await cleanup(packageDir);
    }
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unexpected error:", error); // eslint-disable-line no-console
  process.exit(1);
});
