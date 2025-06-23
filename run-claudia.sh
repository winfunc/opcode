#!/bin/bash

# Claudia Development Launcher
# Solves glibc compatibility issues by running in clean environment

echo "🚀 Starting Claudia Development Environment..."
echo ""

# Check if frontend server is already running
if curl -s http://localhost:1420 > /dev/null 2>&1; then
    echo "✅ Frontend server is already running at http://localhost:1420"
else
    echo "🔧 Starting frontend development server..."
    # Start frontend in background
    bun run dev &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    
    # Wait for frontend to be ready
    echo "⏳ Waiting for frontend server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:1420 > /dev/null 2>&1; then
            echo "✅ Frontend server ready at http://localhost:1420"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "🔧 Starting Tauri backend with clean environment..."

# Check if binary exists and offer to build if not
if [ ! -f "src-tauri/target/debug/claudia" ]; then
    echo "❌ Claudia binary not found at src-tauri/target/debug/claudia"
    echo "🔨 Building Claudia binary..."
    cd src-tauri && cargo build --bin claudia
    if [ $? -ne 0 ]; then
        echo "❌ Failed to build Claudia binary"
        exit 1
    fi
    cd ..
    echo "✅ Claudia binary built successfully"
fi

# Run Tauri backend with clean environment to avoid glibc conflicts
# Preserve OpenRouter API key for Aider/OpenCodex engines
DISPLAY=$DISPLAY \
XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR \
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" \
env -i \
PATH=/usr/bin:/bin \
DISPLAY=$DISPLAY \
XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR \
LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu \
HOME=$HOME \
USER=$USER \
OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
src-tauri/target/debug/claudia

echo ""
echo "🛑 Claudia has been stopped."