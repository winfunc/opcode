#!/bin/bash

echo "🚀 Session Deletion Feature - Contribution Helper"
echo "================================================="
echo ""

# Check if user provided fork URL
if [ $# -eq 0 ]; then
    echo "Usage: ./contribute.sh <YOUR_FORK_URL>"
    echo "Example: ./contribute.sh https://github.com/yourusername/opcode.git"
    echo ""
    echo "Steps:"
    echo "1. Fork https://github.com/getAsterisk/opcode to your GitHub account"
    echo "2. Run this script with your fork URL"
    exit 1
fi

FORK_URL=$1
FORK_DIR="opcode-fork"

echo "📋 Setting up contribution for: $FORK_URL"
echo ""

# Clone the fork
echo "🔄 Cloning your fork..."
git clone "$FORK_URL" "$FORK_DIR"
cd "$FORK_DIR"

# Create feature branch
echo "🌿 Creating feature branch..."
git checkout -b feature/session-deletion-functionality

# Copy our changes
echo "📁 Copying session deletion feature files..."
cp ../src-tauri/src/commands/claude.rs src-tauri/src/commands/claude.rs
cp ../src-tauri/src/main.rs src-tauri/src/main.rs
cp ../src/lib/api.ts src/lib/api.ts
cp ../src/components/SessionList.tsx src/components/SessionList.tsx
cp ../src/components/TabContent.tsx src/components/TabContent.tsx
cp ../src/stores/sessionStore.ts src/stores/sessionStore.ts

# Commit changes
echo "💾 Committing changes..."
git add .
git commit -F ../COMMIT_MESSAGE.txt

# Push to fork
echo "⬆️ Pushing to your fork..."
git push -u origin feature/session-deletion-functionality

echo ""
echo "✅ SUCCESS! Your session deletion feature is ready!"
echo ""
echo "🔗 Next steps:"
echo "1. Go to your fork on GitHub: ${FORK_URL%.*}"
echo "2. Click 'Compare & pull request' button"
echo "3. Set base repository to: getAsterisk/opcode"
echo "4. Set base branch to: main"
echo "5. Use the title: 'Feature: Add session deletion functionality'"
echo "6. Copy the description from COMMIT_MESSAGE.txt"
echo "7. Submit your pull request!"
echo ""
echo "📋 This PR will address Issue #305 and provide the session deletion feature users have requested!"