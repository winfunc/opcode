# macOS Installation Scripts

This directory contains automated installation scripts for Claudia on macOS.

## Scripts

### install.sh
Complete installation script that:
- Checks all dependencies (Rust, Bun, Git)
- Clones the repository
- Builds the application
- Installs to `/Applications`
- Optional cleanup of build files

### update.sh
Quick update script for existing installations that:
- Pulls latest code
- Rebuilds the application
- Replaces the existing app
- Backs up the old version

## Usage

### First Installation

```bash
curl -fsSL https://raw.githubusercontent.com/getAsterisk/claudia/main/scripts/macos/install.sh | bash
```

Or download and run locally:

```bash
chmod +x install.sh
./install.sh
```

### Updating

```bash
chmod +x update.sh
./update.sh
```

## Prerequisites

The scripts will check for:
- **Rust** (1.70.0+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Bun** (latest): `curl -fsSL https://bun.sh/install | bash`
- **Git**: Usually pre-installed on macOS
- **Xcode Command Line Tools**: `xcode-select --install`

## Notes

- First run: macOS may show a security warning. Click "Open" or allow in System Settings.
- DMG bundling may fail but doesn't affect the .app creation
- Build time: 5-10 minutes on first build, depending on network and machine performance