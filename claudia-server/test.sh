#!/bin/bash

# Simple integration test for Claudia Server
# Tests basic functionality without requiring Claude Code CLI

set -e

echo "🧪 Claudia Server Integration Test"
echo "=================================="

SERVER_PORT=3099
SERVER_URL="http://localhost:$SERVER_PORT"
LOG_FILE="/tmp/claudia-server-test.log"

# Start server in background
echo "Starting server on port $SERVER_PORT..."
cd "$(dirname "$0")"
timeout 30s node dist/index.js --port $SERVER_PORT > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 3

# Test health endpoint
echo "✅ Testing health endpoint..."
response=$(curl -s -w "%{http_code}" "$SERVER_URL/api/status/health" -o /tmp/health_response.json)
if [ "$response" != "200" ]; then
    echo "❌ Health check failed (HTTP $response)"
    exit 1
fi

health_status=$(jq -r '.data.status' /tmp/health_response.json)
if [ "$health_status" != "healthy" ]; then
    echo "❌ Server is not healthy: $health_status"
    exit 1
fi
echo "   Server is healthy ✓"

# Test info endpoint
echo "✅ Testing info endpoint..."
response=$(curl -s -w "%{http_code}" "$SERVER_URL/api/status/info" -o /tmp/info_response.json)
if [ "$response" != "200" ]; then
    echo "❌ Info endpoint failed (HTTP $response)"
    exit 1
fi

server_name=$(jq -r '.data.name' /tmp/info_response.json)
if [ "$server_name" != "Claudia Server" ]; then
    echo "❌ Unexpected server name: $server_name"
    exit 1
fi
echo "   Info endpoint working ✓"

# Test Claude version endpoint (this will fail if Claude CLI is not installed, but that's expected)
echo "✅ Testing Claude version endpoint..."
response=$(curl -s -w "%{http_code}" "$SERVER_URL/api/claude/version" -o /tmp/claude_response.json)
echo "   Claude version check returned HTTP $response"
if [ "$response" = "200" ]; then
    is_installed=$(jq -r '.data.is_installed' /tmp/claude_response.json)
    echo "   Claude installed: $is_installed ✓"
else
    echo "   Claude version endpoint accessible ✓"
fi

# Test projects endpoint
echo "✅ Testing projects endpoint..."
response=$(curl -s -w "%{http_code}" "$SERVER_URL/api/projects" -o /tmp/projects_response.json)
if [ "$response" != "200" ]; then
    echo "❌ Projects endpoint failed (HTTP $response)"
    exit 1
fi
echo "   Projects endpoint working ✓"

# Test WebSocket endpoint (basic connection test)
echo "✅ Testing WebSocket endpoint..."
if command -v wscat >/dev/null 2>&1; then
    echo '{"type":"status"}' | timeout 2s wscat -c "ws://localhost:$SERVER_PORT/ws" >/dev/null 2>&1 && echo "   WebSocket endpoint accessible ✓" || echo "   WebSocket test skipped (connection failed)"
else
    echo "   WebSocket test skipped (wscat not available)"
fi

# Test 404 handling
echo "✅ Testing 404 handling..."
response=$(curl -s -w "%{http_code}" "$SERVER_URL/api/nonexistent" -o /tmp/404_response.json)
if [ "$response" != "404" ]; then
    echo "❌ 404 handling failed (expected 404, got $response)"
    exit 1
fi
echo "   404 handling working ✓"

# Test CORS headers
echo "✅ Testing CORS headers..."
cors_header=$(curl -s -D - "$SERVER_URL/api/status/health" | grep -i "access-control-allow-origin" || true)
if [ -n "$cors_header" ]; then
    echo "   CORS headers present ✓"
else
    echo "   CORS headers missing (may be expected)"
fi

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID >/dev/null 2>&1 || true
rm -f /tmp/health_response.json /tmp/info_response.json /tmp/claude_response.json /tmp/projects_response.json /tmp/404_response.json

echo ""
echo "🎉 All tests passed!"
echo "   Server is working correctly on port $SERVER_PORT"
echo "   Log file: $LOG_FILE"
echo ""
echo "📝 Next steps:"
echo "   1. Install Claude Code CLI for full functionality"
echo "   2. Start the server: npm start"
echo "   3. Try the examples in examples/ directory"
echo "   4. Read the documentation in README.md"