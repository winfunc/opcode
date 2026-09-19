#!/bin/bash

# Claudia macOS Update Script
# Quick update for existing installations

set -e

echo "🔄 Updating Claudia..."

# Default to existing claudia directory
CLAUDIA_DIR="$HOME/claudia"

if [ ! -d "$CLAUDIA_DIR" ]; then
    echo "❌ Claudia directory not found: $CLAUDIA_DIR"
    echo "Please run install.sh for initial installation"
    exit 1
fi

cd "$CLAUDIA_DIR"

# Update code
echo "📥 Pulling latest code..."
git pull

# Update dependencies
echo "📦 Updating dependencies..."
bun install

# Build
echo "🔨 Building new version..."
bun run tauri build --no-bundle || true

# Check build result
APP_PATH="$CLAUDIA_DIR/src-tauri/target/release/bundle/macos/Claudia.app"
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Build failed"
    exit 1
fi

# Kill running Claudia
echo "🔄 Preparing to replace app..."
killall Claudia 2>/dev/null || true

# Backup old version (optional)
if [ -d "/Applications/Claudia.app" ]; then
    echo "📋 Backing up old version..."
    rm -rf "/Applications/Claudia.app.backup"
    mv "/Applications/Claudia.app" "/Applications/Claudia.app.backup"
fi

# Install new version
echo "📱 Installing new version..."
cp -r "$APP_PATH" /Applications/

echo "✅ Claudia updated successfully!"

# Launch new version
read -p "Launch new version? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open /Applications/Claudia.app
fi