# Build Scripts

This directory contains scripts for building Claude Code executables for all supported platforms.

## Scripts

### `fetch-and-build.js`
Main build script that:
1. Downloads the `@anthropic-ai/claude-code` package from npm
2. Extracts and copies required files (cli.js, yoga.wasm, vendor/)
3. Builds executables for specified platforms
4. Cleans up temporary files

**Usage:**
```bash
# Build for all platforms
bun run scripts/fetch-and-build.js

# Build for specific platform
bun run scripts/fetch-and-build.js linux
bun run scripts/fetch-and-build.js macos
bun run scripts/fetch-and-build.js windows
bun run scripts/fetch-and-build.js current  # Current platform only
```

### `build-executables.js`
Low-level script that builds executables from existing source files. This is called automatically by `fetch-and-build.js`.

### `prepare-bundle-native.js`
Prepares the CLI source for bundling by embedding assets using Bun's native embedding features.

## NPM Scripts

The following npm scripts are available in `package.json`:

```bash
# Build executables for all platforms
npm run build:executables

# Build for specific platforms
npm run build:executables:current
npm run build:executables:linux
npm run build:executables:macos
npm run build:executables:windows
```

## Output

All executables are created in the `src-tauri/binaries/` directory with the following naming convention:

### Linux Executables
- `claude-code-linux-x64` - Standard Linux x64 (glibc)
- `claude-code-linux-x64-modern` - Modern CPUs (AVX2+)
- `claude-code-linux-x64-baseline` - Older CPUs (pre-2013)
- `claude-code-linux-arm64` - ARM64 Linux
- `claude-code-linux-x64-musl` - Alpine Linux (musl)
- `claude-code-linux-x64-musl-modern` - Alpine + modern CPUs
- `claude-code-linux-x64-musl-baseline` - Alpine + older CPUs
- `claude-code-linux-arm64-musl` - ARM64 Alpine

### macOS Executables
- `claude-code-macos-x64` - Intel Mac
- `claude-code-macos-x64-modern` - Intel Mac (modern CPUs)
- `claude-code-macos-x64-baseline` - Intel Mac (older CPUs)
- `claude-code-macos-arm64` - Apple Silicon Mac

### Windows Executables
- `claude-code-windows-x64.exe` - Windows x64
- `claude-code-windows-x64-modern.exe` - Windows x64 (modern CPUs)
- `claude-code-windows-x64-baseline.exe` - Windows x64 (older CPUs)

## Features

- **Embedded Assets**: All executables include embedded yoga.wasm and ripgrep binaries
- **Optimizations**: Built with minification and sourcemaps
- **Cross-platform**: Supports all major operating systems and architectures
- **CPU Variants**: Modern variants for newer CPUs (2013+), baseline for compatibility
- **Self-contained**: No external dependencies required at runtime
- **Tauri Integration**: Automatic sidecar binary naming for seamless Tauri integration

## Requirements

- **Bun**: Required for building (uses Bun's native compilation features)
- **npm**: Used to download the Claude Code package
- **tar**: For extracting the package (standard on Unix systems) 
