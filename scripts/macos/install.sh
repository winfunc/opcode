#!/bin/bash

# Claudia macOS Installation Script
# Automates the complete installation process from GitHub to Applications folder

set -e  # Exit on error

echo "🚀 Starting Claudia installation for macOS..."

# 1. Check dependencies
echo "📋 Checking dependencies..."

# Check Rust
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not installed. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi
echo "✅ Rust installed: $(rustc --version)"

# Check Bun
if ! command -v bun &> /dev/null; then
    echo "❌ Bun not installed. Please install Bun first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo "✅ Bun installed: $(bun --version)"

# Check Git
if ! command -v git &> /dev/null; then
    echo "❌ Git not installed"
    exit 1
fi
echo "✅ Git installed"

# 2. Choose installation directory
INSTALL_DIR="$HOME/claudia-build"
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  Directory $INSTALL_DIR already exists"
    read -p "Delete and reinstall? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "❌ Installation cancelled"
        exit 1
    fi
fi

# 3. Clone repository
echo "📦 Cloning Claudia repository..."
git clone https://github.com/getAsterisk/claudia.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 4. Install dependencies
echo "📚 Installing project dependencies..."
bun install

# 5. Build application
echo "🔨 Building Claudia (this may take a few minutes)..."
bun run tauri build --no-bundle || {
    echo "⚠️  DMG bundling failed, but .app should be created"
}

# 6. Check build result
APP_PATH="$INSTALL_DIR/src-tauri/target/release/bundle/macos/Claudia.app"
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Build failed: Claudia.app not found"
    exit 1
fi

echo "✅ Claudia.app built successfully!"

# 7. Install to Applications
echo "📱 Installing Claudia to Applications folder..."

# Check if already exists
if [ -d "/Applications/Claudia.app" ]; then
    echo "⚠️  /Applications/Claudia.app already exists"
    read -p "Overwrite? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "/Applications/Claudia.app"
    else
        echo "❌ Installation cancelled"
        exit 1
    fi
fi

# Copy to Applications
cp -r "$APP_PATH" /Applications/

# 8. Cleanup (optional)
read -p "Delete build directory to save space? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$HOME"
    rm -rf "$INSTALL_DIR"
    echo "✅ Build directory cleaned up"
fi

echo "🎉 Claudia installation complete!"
echo ""
echo "📌 How to use:"
echo "   1. Open Claudia from Launchpad"
echo "   2. Or from Finder → Applications → Claudia"
echo "   3. Or use Spotlight search for 'Claudia'"
echo ""
echo "⚠️  First run: macOS may show a security warning"
echo "   Click 'Open' or allow in System Settings"

# Ask to launch
read -p "Launch Claudia now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open /Applications/Claudia.app
fi